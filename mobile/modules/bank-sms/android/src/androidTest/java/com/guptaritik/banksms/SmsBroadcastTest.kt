package com.guptaritik.banksms

import android.Manifest
import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SmsBroadcastTest {
    @Test fun deliversMaskedBroadcastRetriesAndRetainsRevokedAlert() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val owner = "instrumented-owner"
        val state = SmsState.get(context)
        instrumentation.uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.RECEIVE_SMS)
        synchronized(SmsState.lock) {
            state.disconnect()
            state.configure(owner, "instrumented-device", "mock-device-token", "http://10.0.2.2:18764")
        }
        try {
            Log.i("BankSmsTest", "READY_FOR_SMS")
            await("The broadcast did not reach a successful retry") {
                state.lastSent != null && state.outbox.count(owner) == 0
            }
            synchronized(SmsState.lock) {
                assertTrue(state.add("HDFCBK", "Test Rs.1.00 from A/C X1234 Ref 999912345678", System.currentTimeMillis()))
            }
            SmsWorker.schedule(context)
            await("The mock 401 did not revoke the device") { state.revoked }
            synchronized(SmsState.lock) {
                assertNull(state.credentials())
                assertEquals(1, state.outbox.count(owner))
                assertEquals("Device revoked: sign in again", state.lastError)
            }
        } finally {
            SmsWorker.cancel(context)
            synchronized(SmsState.lock) { state.disconnect() }
        }
    }

    private fun await(message: String, check: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 60_000
        while (SystemClock.elapsedRealtime() < deadline) {
            if (synchronized(SmsState.lock) { check() }) return
            SystemClock.sleep(200)
        }
        fail(message)
    }
}
