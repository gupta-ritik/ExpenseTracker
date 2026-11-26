package com.guptaritik.banksms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import java.util.concurrent.Executors

class BankSmsReceiver : BroadcastReceiver() {
    companion object { private val executor = Executors.newSingleThreadExecutor() }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val pending = goAsync()
        val app = context.applicationContext
        executor.execute {
            try {
                val state = SmsState.get(app)
                val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                val first = parts.firstOrNull() ?: return@execute
                val sender = first.originatingAddress ?: return@execute
                val queued = synchronized(SmsState.lock) {
                    if (!SmsPrivacy.allowed(sender, state.senders) || parts.any { it.originatingAddress != sender }) false
                    else state.add(sender, parts.joinToString("") { it.messageBody.orEmpty() }, first.timestampMillis)
                }
                if (queued) {
                    SmsWorker.schedule(app)
                    SmsEvents.emit("sms:queued")
                }
            } finally {
                pending.finish()
            }
        }
    }
}
