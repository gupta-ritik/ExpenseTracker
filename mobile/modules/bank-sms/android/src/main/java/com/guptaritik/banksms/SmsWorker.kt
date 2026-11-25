package com.guptaritik.banksms

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

internal object SmsEvents {
    @Volatile var listener: ((String, Map<String, Any>) -> Unit)? = null
    fun emit(name: String, values: Map<String, Any> = emptyMap()) { listener?.invoke(name, values) }
}

internal enum class Delivery { SENT, REVOKED, RETRY, FAILED }
internal fun classifyDelivery(status: Int) = when (status) {
    in 200..299 -> Delivery.SENT
    401 -> Delivery.REVOKED
    408, 429, in 500..599 -> Delivery.RETRY
    else -> Delivery.FAILED
}

class SmsWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    companion object {
        private const val UNIQUE_WORK = "bank-sms-outbox"

        internal fun schedule(context: Context, explicit: Boolean = false) {
            val work = OneTimeWorkRequestBuilder<SmsWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_WORK,
                if (explicit) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.APPEND_OR_REPLACE, work)
        }

        internal fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK)
        }
    }

    override fun doWork(): Result {
        val state = SmsState.get(applicationContext)
        repeat(10) {
            val (credentials, batch) = synchronized(SmsState.lock) {
                val current = state.credentials() ?: return Result.success()
                current to state.outbox.batch(current.owner)
            }
            if (batch.isEmpty() || isStopped) return Result.success()
            val outcome = try { classifyDelivery(post(credentials, batch)) } catch (_: IOException) { Delivery.RETRY }
            synchronized(SmsState.lock) {
                if (state.credentials() != credentials || isStopped) return Result.success()
                when (outcome) {
                    Delivery.SENT -> {
                        state.outbox.remove(credentials.owner, batch)
                        state.sent()
                        SmsEvents.emit("sms:sent", mapOf("sent" to batch.size))
                    }
                    Delivery.REVOKED -> {
                        state.markRevoked(credentials.id)
                        SmsEvents.emit("sms:failed", mapOf("revoked" to true))
                        return Result.success()
                    }
                    Delivery.RETRY, Delivery.FAILED -> {
                        state.failed()
                        SmsEvents.emit("sms:failed")
                        return if (outcome == Delivery.RETRY) Result.retry() else Result.failure()
                    }
                }
            }
        }
        return Result.retry()
    }

    private fun post(credentials: Credentials, entries: List<Alert>): Int {
        val batch = JSONArray()
        for (entry in entries) batch.put(JSONObject().put("sender", entry.sender)
            .put("text", entry.text).put("receivedAt", entry.receivedAt))
        val bytes = JSONObject().put("messages", batch).toString().toByteArray(Charsets.UTF_8)
        val connection = URL(credentials.baseUrl + "/api/ingest/sms").openConnection() as HttpURLConnection
        return try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15_000
            connection.readTimeout = 35_000
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.setFixedLengthStreamingMode(bytes.size)
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer " + credentials.token)
            connection.outputStream.use { it.write(bytes) }
            connection.responseCode
        } finally {
            connection.disconnect()
        }
    }
}
