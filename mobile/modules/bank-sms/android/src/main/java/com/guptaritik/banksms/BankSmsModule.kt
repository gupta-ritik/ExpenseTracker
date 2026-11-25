package com.guptaritik.banksms

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.PowerManager
import android.provider.Settings
import android.provider.Telephony
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.util.TimeZone

class BankSmsModule : Module() {
    private val context get() = requireNotNull(appContext.reactContext).applicationContext
    private val state get() = SmsState.get(context)
    private val eventListener: (String, Map<String, Any>) -> Unit = { event, values -> sendEvent(event, values) }

    override fun definition() = ModuleDefinition {
        Name("BankSms")
        Events("sms:queued", "sms:sent", "sms:failed", "sms:progress")
        OnCreate { SmsEvents.listener = eventListener }
        OnDestroy { if (SmsEvents.listener === eventListener) SmsEvents.listener = null }

        AsyncFunction("getStatus") { status() }
        AsyncFunction("getQueue") {
            synchronized(SmsState.lock) { mapOf("queued" to (state.owner?.let(state.outbox::count) ?: 0)) }
        }
        AsyncFunction("requestPermissions") { promise: Promise ->
            Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise,
                Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS)
        }
        AsyncFunction("setSenderList") { senders: List<String> ->
            synchronized(SmsState.lock) { state.setSenders(senders) }
        }
        AsyncFunction("configure") { owner: String, id: String, token: String, baseUrl: String ->
            synchronized(SmsState.lock) { state.configure(owner, id, token, baseUrl) }
            SmsWorker.schedule(context)
        }
        AsyncFunction("disconnect") {
            synchronized(SmsState.lock) { state.disconnect() }
            SmsWorker.cancel(context)
        }
        AsyncFunction("revokeDevice") { id: String ->
            synchronized(SmsState.lock) { state.markRevoked(id) }
        }
        AsyncFunction("retryNow") { SmsWorker.schedule(context, explicit = true) }
        AsyncFunction("clearQueue") { synchronized(SmsState.lock) { state.outbox.clear() } }
        AsyncFunction("pasteSms") { sender: String, body: String ->
            val queued = synchronized(SmsState.lock) { state.add(sender, body, System.currentTimeMillis()) }
            if (queued) {
                SmsWorker.schedule(context)
                SmsEvents.emit("sms:queued")
            }
            queued
        }
        AsyncFunction("importPastSms") { months: Int -> importPastSms(months) }
        AsyncFunction("openBatterySettings") {
            context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    private fun has(permission: String) = context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun status(): Map<String, Any?> = synchronized(SmsState.lock) {
        val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        mapOf(
            "receivePermission" to has(Manifest.permission.RECEIVE_SMS),
            "readPermission" to has(Manifest.permission.READ_SMS),
            "batteryOptimized" to !power.isIgnoringBatteryOptimizations(context.packageName),
            "queueSize" to (state.owner?.let(state.outbox::count) ?: 0),
            "lastSent" to state.lastSent, "revoked" to state.revoked, "deviceId" to state.id,
            "ownerId" to state.owner, "baseUrl" to state.baseUrl, "senders" to state.senders, "lastError" to state.lastError
        )
    }

    private fun importPastSms(months: Int): Int {
        require(months in listOf(1, 3, 6))
        check(has(Manifest.permission.READ_SMS)) { "Inbox access has not been granted." }
        val store = state
        val owner = synchronized(SmsState.lock) { store.owner } ?: error("Sign in to import bank alerts.")
        val start = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata")).apply {
            add(Calendar.MONTH, -months)
        }.timeInMillis
        val columns = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE)
        var scanned = 0
        var queued = 0
        try {
            context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI, columns,
                "${Telephony.Sms.DATE} >= ?", arrayOf(start.toString()), "${Telephony.Sms.DATE} ASC")?.use { cursor ->
                while (cursor.moveToNext()) {
                    scanned += 1
                    val sender = cursor.getString(0).orEmpty()
                    synchronized(SmsState.lock) {
                        check(store.owner == owner) { "The active account has changed." }
                        if (SmsPrivacy.allowed(sender, store.senders) &&
                            store.add(sender, cursor.getString(1).orEmpty(), cursor.getLong(2))) queued += 1
                    }
                    if (scanned % 50 == 0) SmsEvents.emit("sms:progress", mapOf("scanned" to scanned, "queued" to queued))
                }
            } ?: error("Android could not read the SMS inbox.")
            SmsEvents.emit("sms:progress", mapOf("scanned" to scanned, "queued" to queued))
            return queued
        } finally {
            if (queued > 0) {
                SmsWorker.schedule(context)
                SmsEvents.emit("sms:queued")
            }
        }
    }
}
