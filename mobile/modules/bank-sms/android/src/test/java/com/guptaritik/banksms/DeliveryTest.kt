package com.guptaritik.banksms

import org.junit.Assert.assertEquals
import org.junit.Test

class DeliveryTest {
    @Test fun successfulRequestsAcknowledgeTheBatch() {
        assertEquals(Delivery.SENT, classifyDelivery(201))
        assertEquals(Delivery.SENT, classifyDelivery(202))
    }

    @Test fun rateLimitsTimeoutsAndServerErrorsKeepTheBatchForRetry() {
        for (status in listOf(408, 429, 500, 503)) assertEquals(Delivery.RETRY, classifyDelivery(status))
    }

    @Test fun unauthorizedStopsDeliveryAndKeepsTheBatch() {
        assertEquals(Delivery.REVOKED, classifyDelivery(401))
    }

    @Test fun redirectsAndInvalidRequestsRequireIntervention() {
        for (status in listOf(301, 400, 413)) assertEquals(Delivery.FAILED, classifyDelivery(status))
    }
}
