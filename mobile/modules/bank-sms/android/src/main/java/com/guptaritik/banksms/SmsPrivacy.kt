package com.guptaritik.banksms

import java.text.Normalizer
import java.util.Locale

internal object SmsPrivacy {
    val defaults = listOf(
        "HDFCBK", "HDFCBN", "SBIINB", "SBIPSG", "SBIUPI", "ATMSBI", "CBSSBI", "SBICRD",
        "ICICIB", "ICICIT", "AXISBK", "AXISCC", "KOTAKB", "KOTAKM", "GPAY", "GOOGLEPAY",
        "PHONEPE", "PAYTM", "PYTMBK"
    ).map { "*-$it" }

    private val senderId = Regex("^[A-Z0-9]{3,11}$")
    private val senderPrefix = Regex("^[A-Z0-9]{2}-")
    private val senderSuffix = Regex("-[A-Z]$")
    private val verification = insensitive("""\b(?:otp|one[- ]time (?:password|code)|verification code|security code)\b|\[CODE\]""")
    private val controls = Regex("""[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]""")
    private val devanagari = Regex("[०-९]")
    private val account = insensitive("""\b((?:a\s*/?\s*c|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s+in)?))?[\s:#-]*)([Xx*•]*\d[\d Xx*•-]{2,26}\d)\b""")
    private val halfMasked = Regex("""\b\d{4,6}[Xx*•]{2,10}(\d{4})\b""")
    private val masked = insensitive("""\b(?:x{2,}|[•*]{2,})\s*(\d{4})(?!\d)""")
    private val pan = insensitive("""\b[A-Z]{5}\d{4}[A-Z]\b""")
    private val email = insensitive("""[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Z]{2,}\b""")
    private val aadhaar = Regex("""(?<![\w\d])(?:\d{4}[- ]?\d{4}[- ]?\d{4})(?!\d)""")
    private val phone = Regex("""(?<![\w\d])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)""")
    private val tollFree = Regex("""(?<![\w\d])1[ -]?800(?:[ -]?\d){7}(?!\d)""")
    private val longDigits = Regex("""(?<![\w\d])(?:\d[ -]?){13,18}\d(?!\d)""")
    private val reference = insensitive("""(?:\b(?:ref(?:erence)?|refno|utr|rrn|txn|trxn|transaction)\.?(?:\s*(?:no\.?|number|id))?(?:\s+is)?[\s:#.-]*|\bUPI[/:-]\s*(?:P2[AM]/)?|\bIMPS[/:-]\s*)$""")
    private val details = Regex("""^\s*(?:investor(?:\s+name)?|holder(?:\s+name)?|customer(?:\s+name)?|name|address|communication address)\s*:\s*.*$""",
        setOf(RegexOption.IGNORE_CASE, RegexOption.MULTILINE))

    private fun insensitive(pattern: String) = Regex(pattern, RegexOption.IGNORE_CASE)

    fun senderComponent(sender: String) = sender.trim().uppercase(Locale.ROOT)
        .replace(senderPrefix, "").replace(senderSuffix, "")

    fun allowed(sender: String, senders: List<String>): Boolean {
        val component = senderComponent(sender)
        return senderId.matches(component) && component.any { it in 'A'..'Z' } && senders.any { it.uppercase(Locale.ROOT).removePrefix("*-") == component }
    }

    fun clean(sender: String, text: String, senders: List<String>): String? {
        if (!allowed(sender, senders) || text.isBlank() || text.length > 2000) return null
        val normalized = normalize(text)
        if (verification.containsMatchIn(normalized)) return null
        return mask(normalized).takeIf { it.isNotBlank() && it.length <= 2000 }
    }

    private fun normalize(text: String) = Normalizer.normalize(text, Normalizer.Form.NFKC)
        .replace(controls, "").replace(devanagari) { (it.value[0] - '०').toString() }

    private fun replaceExceptReference(text: String, pattern: Regex, replacement: String) =
        pattern.replace(text) {
            val offset = it.range.first
            if (reference.containsMatchIn(text.substring(maxOf(0, offset - 28), offset))) it.value
            else replacement
        }

    private fun mask(text: String): String {
        val initial = text.replace(details, "[PERSONAL DETAILS]")
            .replace(account) {
                val digits = it.groupValues[2].filter { char -> char in '0'..'9' }
                if (digits.length == 4 || digits.length >= 8) it.groupValues[1] + "****" + digits.takeLast(4)
                else it.value
            }
            .replace(halfMasked) { "****" + it.groupValues[1] }
            .replace(pan, "[PAN]").replace(email, "[EMAIL]")
        val ids = replaceExceptReference(initial, aadhaar, "[ID]")
        val phones = replaceExceptReference(replaceExceptReference(ids, phone, "[PHONE]"), tollFree, "[PHONE]")
        return replaceExceptReference(phones, longDigits, "[NUMBER]").replace(masked) { "****" + it.groupValues[1] }
    }
}
