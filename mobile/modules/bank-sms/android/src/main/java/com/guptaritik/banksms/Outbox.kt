package com.guptaritik.banksms

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

internal data class Alert(val id: Long, val sender: String, val text: String, val receivedAt: Long)

internal class Outbox(context: Context) : SQLiteOpenHelper(context, "bank-sms.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""CREATE TABLE outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            received_at INTEGER NOT NULL,
            UNIQUE(owner, sender, text, received_at)
        )""")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    fun insert(owner: String, sender: String, masked: String, receivedAt: Long): Boolean =
        writableDatabase.insertWithOnConflict("outbox", null, ContentValues().apply {
            put("owner", owner)
            put("sender", sender)
            put("text", masked)
            put("received_at", receivedAt)
        }, SQLiteDatabase.CONFLICT_IGNORE) != -1L

    fun batch(owner: String): List<Alert> = readableDatabase.rawQuery(
        "SELECT id, sender, text, received_at FROM outbox WHERE owner = ? ORDER BY id LIMIT 50",
        arrayOf(owner)
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(Alert(cursor.getLong(0), cursor.getString(1), cursor.getString(2), cursor.getLong(3)))
        }
    }

    fun count(owner: String): Int = readableDatabase.rawQuery(
        "SELECT COUNT(*) FROM outbox WHERE owner = ?", arrayOf(owner)
    ).use { cursor -> cursor.moveToFirst(); cursor.getInt(0) }

    fun remove(owner: String, entries: List<Alert>) {
        val slots = entries.joinToString(",") { "?" }
        writableDatabase.delete("outbox", "owner = ? AND id IN ($slots)",
            arrayOf(owner, *entries.map { it.id.toString() }.toTypedArray()))
    }

    fun clear() { writableDatabase.delete("outbox", null, null) }
}
