package com.guptaritik.banksms

import org.junit.Assert.*
import org.junit.Test

class SmsPrivacyTest {
    @Test fun filtersCanonicalAndPrefixedBankIds() {
        assertTrue(SmsPrivacy.allowed("vm-hdfcbk-s", SmsPrivacy.defaults))
        assertTrue(SmsPrivacy.allowed("GPAY", SmsPrivacy.defaults))
        assertFalse(SmsPrivacy.allowed("+919987654321", SmsPrivacy.defaults))
        assertFalse(SmsPrivacy.allowed("VM-HDFCBKX", SmsPrivacy.defaults))
        assertFalse(SmsPrivacy.allowed("HDFCBK", listOf("*-SBIINB")))
    }

    @Test fun masksSharedAlertFixtures() {
        val fixtures = listOf("axis", "hdfc", "icici", "kotak", "negatives", "sbi", "upi-apps")
        var count = 0
        for (file in fixtures) {
            val input = requireNotNull(javaClass.getResourceAsStream("/$file.txt"))
                .bufferedReader(Charsets.UTF_8).use { it.readText() }.replace("\r\n", "\n")
            for (block in input.trim().split("\n---\n")) {
                val (header, expected, body) = block.split("\n", limit = 3)
                val sender = header.removePrefix("sender:").trim()
                val label = "$file alert ${++count}"
                val masked = SmsPrivacy.clean(sender, body, SmsPrivacy.defaults)
                if (expected.contains("ignore Verification code")) {
                    assertNull(label, masked)
                    continue
                }
                if (expected.contains("ignore")) continue
                assertNotNull(label, masked)
                val result = requireNotNull(masked)
                Regex("""ref=([A-Z0-9-]+)""").find(expected)?.let {
                    assertTrue(label, result.contains(it.groupValues[1], ignoreCase = true))
                }
                Regex("""last4=([0-9]{4})""").find(expected)?.let {
                    assertTrue(label, result.contains(it.groupValues[1]))
                }
                assertFalse(label, result.contains("7308080808"))
                assertFalse(label, result.contains("18002586161"))
            }
        }
        assertTrue(count >= 45)
    }

    @Test fun dropsObfuscatedVerificationAndMasksSensitiveNumbers() {
        assertNull(SmsPrivacy.clean("HDFCBK", "ＯＴＰ １２３４５６", SmsPrivacy.defaults))
        val result = SmsPrivacy.clean("HDFCBK",
            "Card 412345XXXXXX5678 A/c 123456781234 phone +91 98765 43210 PAN ABCDE1234F Ref 433212345678.",
            SmsPrivacy.defaults)
        assertEquals("Card ****5678 A/c ****1234 phone [PHONE] PAN [PAN] Ref 433212345678.", result)
    }
}
