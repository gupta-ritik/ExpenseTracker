package com.guptaritik.banksms

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.net.URI

internal data class Credentials(val owner: String, val id: String, val token: String, val baseUrl: String)

@Suppress("DEPRECATION")
internal class SmsState(private val context: Context) {
    companion object {
        val lock = Any()
        @Volatile private var instance: SmsState? = null
        fun get(context: Context): SmsState = instance ?: synchronized(lock) {
            instance ?: SmsState(context.applicationContext).also { instance = it }
        }
    }

    private val metadata = context.getSharedPreferences("bank-sms", Context.MODE_PRIVATE)
    private val vault by lazy {
        EncryptedSharedPreferences.create(context, "bank-sms-vault",
            MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
    }
    val outbox = Outbox(context)
    val owner get() = metadata.getString("owner", null)
    val id get() = metadata.getString("id", null)
    val baseUrl get() = metadata.getString("baseUrl", null)
    val revoked get() = metadata.getBoolean("revoked", false)
    val lastSent get() = metadata.getLong("lastSent", 0L).takeIf { it != 0L }
    val lastError get() = metadata.getString("lastError", null)
    val senders get() = metadata.getString("senders", null)?.split(',')?.filter(String::isNotEmpty) ?: SmsPrivacy.defaults

    fun credentials(): Credentials? {
        if (revoked) return null
        val owner = owner ?: return null
        val id = id ?: return null
        val baseUrl = baseUrl ?: return null
        val token = vault.getString(id, null) ?: return null
        return Credentials(owner, id, token, baseUrl)
    }

    fun setSenders(senders: List<String>) {
        val valid = Regex("""^(?:\*-)?[A-Z0-9]{3,11}$""")
        check(metadata.edit().putString("senders", senders.filter(valid::matches).take(100).joinToString(",")).commit())
    }

    fun configure(owner: String, id: String, token: String, baseUrl: String) {
        val url = URI(baseUrl)
        val local = url.host == "localhost" || url.host == "127.0.0.1" ||
            url.host == "10.0.2.2" || url.host?.matches(Regex("""(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)[0-9.]+""")) == true
        require(url.host != null && url.userInfo == null && url.query == null && url.fragment == null &&
            (url.scheme == "https" || (url.scheme == "http" && local))) { "Use HTTPS or a local development address." }
        val previousId = this.id
        if (this.owner != null && this.owner != owner) outbox.clear()
        check(vault.edit().putString(id, token).commit())
        check(metadata.edit().putString("owner", owner).putString("id", id).putString("baseUrl", baseUrl.trimEnd('/'))
            .putBoolean("revoked", false).remove("lastError").commit())
        if (previousId != null && previousId != id) vault.edit().remove(previousId).apply()
    }

    fun markRevoked(id: String) {
        if (this.id != id) return
        check(metadata.edit().putBoolean("revoked", true).putString("lastError", "Device revoked: sign in again").commit())
        vault.edit().remove(id).apply()
    }

    fun sent() { metadata.edit().putLong("lastSent", System.currentTimeMillis()).remove("lastError").apply() }
    fun failed() { metadata.edit().putString("lastError", "Could not send queued alerts.").apply() }

    fun disconnect() {
        check(metadata.edit().clear().commit())
        check(vault.edit().clear().commit())
        outbox.clear()
    }

    fun add(sender: String, text: String, receivedAt: Long): Boolean {
        val owner = owner ?: return false
        val masked = SmsPrivacy.clean(sender, text, senders) ?: return false
        // The raw sender and text never reach SQLite or WorkManager.
        return outbox.insert(owner, SmsPrivacy.senderComponent(sender), masked, receivedAt)
    }
}
