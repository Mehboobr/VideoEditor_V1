package com.createvideo

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.bridge.ActivityEventListener

class FilePickerModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pickerPromise: Promise? = null

    companion object {
        private const val PICK_FILE_REQUEST = 1
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "FilePicker"
    }

    @ReactMethod
    fun pickFile(promise: Promise) {
        val activity = reactApplicationContext.currentActivity

        if (activity == null) {
            promise.reject("ERROR", "Activity doesn't exist")
            return
        }

        pickerPromise = promise

        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "*/*"
            intent.addCategory(Intent.CATEGORY_OPENABLE)
            
            activity.startActivityForResult(intent, PICK_FILE_REQUEST)
        } catch (e: Exception) {
            pickerPromise?.reject("ERROR", e.message)
            pickerPromise = null
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == PICK_FILE_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val uri: Uri? = data.data
                if (uri != null) {
                    val result = Arguments.createMap()
                    result.putString("uri", uri.toString())
                    result.putString("path", uri.path)
                    pickerPromise?.resolve(result)
                } else {
                    pickerPromise?.reject("ERROR", "No file selected")
                }
            } else {
                pickerPromise?.reject("CANCELLED", "User cancelled file picker")
            }
            pickerPromise = null
        }
    }

    override fun onNewIntent(intent: Intent) {
        // Not needed for this module
    }
}

