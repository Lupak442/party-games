package com.partygamesapp

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import android.app.AlertDialog
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar

    // 스플래시 & 서버 콜드스타트 대기 UI
    private lateinit var splashLayout: LinearLayout
    private lateinit var splashTitle: TextView
    private lateinit var splashSubtitle: TextView
    private lateinit var splashStatusText: TextView
    private lateinit var splashProgressBar: ProgressBar
    private var splashTimer: CountDownTimer? = null

    // 오프라인/오류 화면
    private lateinit var errorLayout: LinearLayout
    private lateinit var errorMsg: TextView
    private lateinit var btnRetry: Button
    private lateinit var btnSettings: Button
    private lateinit var prefs: SharedPreferences

    private var backPressedTime: Long = 0

    companion object {
        private const val PREFS_NAME = "PartyGamesHostPrefs"
        private const val KEY_SERVER_URL = "server_url"
        // Render 클라우드 공식 서버 주소
        const val DEFAULT_SERVER_URL = "https://party-games-cxo2.onrender.com"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // 화사한 아케이드 테마(#f4f6fb)에 맞춘 상태바 & 내비게이션바
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.parseColor("#f4f6fb")
        window.navigationBarColor = Color.parseColor("#f4f6fb")
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = true
        controller.isAppearanceLightNavigationBars = true

        setupUI()
        setupWebView()
        setupBackPress()

        loadGameUrl()
    }

    /* ---- 1. UI 및 웹뷰 세팅 ---- */
    private fun setupUI() {
        val root = android.widget.FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#f4f6fb"))
        }

        webView = WebView(this).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#f4f6fb"))
        }
        root.addView(webView)

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                10
            )
            isIndeterminate = false
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#5b5bf7"))
            visibility = View.GONE
        }
        root.addView(progressBar)

        // 스플래시 & 서버 콜드스타트 대기 화면
        splashLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setPadding(48, 48, 48, 48)
            setBackgroundColor(Color.parseColor("#f4f6fb"))
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )

            val logo = TextView(this@MainActivity).apply {
                text = "🎲"
                textSize = 56f
                gravity = android.view.Gravity.CENTER
            }
            addView(logo)

            splashTitle = TextView(this@MainActivity).apply {
                text = "파티 게임즈"
                textSize = 26f
                setTextColor(Color.parseColor("#191f28"))
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                gravity = android.view.Gravity.CENTER
                setPadding(0, 16, 0, 4)
            }
            addView(splashTitle)

            splashSubtitle = TextView(this@MainActivity).apply {
                text = "친구들과 함께하는 실시간 파티 보드게임 ✨"
                textSize = 14f
                setTextColor(Color.parseColor("#5b5bf7"))
                gravity = android.view.Gravity.CENTER
                setPadding(0, 0, 0, 36)
            }
            addView(splashSubtitle)

            splashProgressBar = ProgressBar(this@MainActivity).apply {
                indeterminateTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#5b5bf7"))
            }
            addView(splashProgressBar)

            splashStatusText = TextView(this@MainActivity).apply {
                text = "서버에 연결하는 중… 🚀"
                textSize = 13f
                setTextColor(Color.parseColor("#6b7684"))
                gravity = android.view.Gravity.CENTER
                setPadding(0, 20, 0, 0)
            }
            addView(splashStatusText)
        }
        root.addView(splashLayout)

        // 오프라인 / 서버 연결 실패 화면
        errorLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setPadding(48, 48, 48, 48)
            visibility = View.GONE
            setBackgroundColor(Color.parseColor("#f4f6fb"))
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )

            val icon = TextView(this@MainActivity).apply {
                text = "📡❌"
                textSize = 48f
                gravity = android.view.Gravity.CENTER
            }
            addView(icon)

            val title = TextView(this@MainActivity).apply {
                text = "파티 게임즈 서버 연결 실패"
                textSize = 20f
                setTextColor(Color.parseColor("#191f28"))
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                gravity = android.view.Gravity.CENTER
                setPadding(0, 24, 0, 8)
            }
            addView(title)

            errorMsg = TextView(this@MainActivity).apply {
                text = "서버가 켜져 있는지 확인해주세요."
                textSize = 14f
                setTextColor(Color.parseColor("#6b7684"))
                gravity = android.view.Gravity.CENTER
                setPadding(0, 0, 0, 32)
            }
            addView(errorMsg)

            val btnLayout = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER
            }

            btnRetry = Button(this@MainActivity).apply {
                text = "다시 시도"
                setBackgroundColor(Color.parseColor("#5b5bf7"))
                setTextColor(Color.WHITE)
                setOnClickListener { loadGameUrl() }
            }
            btnLayout.addView(btnRetry)

            btnSettings = Button(this@MainActivity).apply {
                text = "서버 주소 변경"
                setBackgroundColor(Color.parseColor("#e2e8f0"))
                setTextColor(Color.parseColor("#191f28"))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { leftMargin = 24 }
                setOnClickListener { showServerSettingsDialog() }
            }
            btnLayout.addView(btnSettings)

            addView(btnLayout)
        }
        root.addView(errorLayout)

        setContentView(root)
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        webView.addJavascriptInterface(AndroidBridgeInterface(this), "AndroidBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                injectHostAppFlags()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectHostAppFlags()
                cancelSplashTimer()
                splashLayout.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    cancelSplashTimer()
                    showError(error?.description?.toString() ?: "연결 오류")
                }
            }
        }
    }

    private fun startSplashTimer() {
        cancelSplashTimer()
        splashLayout.visibility = View.VISIBLE
        splashStatusText.text = "서버에 연결하는 중… 🚀"

        splashTimer = object : CountDownTimer(45000, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val elapsed = 45 - (millisUntilFinished / 1000)
                when {
                    elapsed in 4..14 -> {
                        splashStatusText.text = "클라우드 서버 깨우는 중… (${elapsed}초)\n(무료 서버 슬립 해제에 15~20초 소요됩니다)"
                    }
                    elapsed in 15..29 -> {
                        splashStatusText.text = "거의 다 됐어요! 게임 리소스 준비 중… (${elapsed}초)"
                    }
                    elapsed >= 30 -> {
                        splashStatusText.text = "네트워크 상태 확인 중… (${elapsed}초)"
                    }
                }
            }

            override fun onFinish() {
                if (splashLayout.visibility == View.VISIBLE) {
                    showError("서버 응답 시간 초과 (45초 경과)")
                }
            }
        }.start()
    }

    private fun cancelSplashTimer() {
        splashTimer?.cancel()
        splashTimer = null
    }

    private fun injectHostAppFlags() {
        webView.evaluateJavascript(
            """
            (function() {
                window.isPartyGamesApp = true;
                localStorage.setItem('pg_is_app', '1');
            })();
            """.trimIndent(),
            null
        )
    }

    private fun loadGameUrl() {
        val url = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        errorLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE
        startSplashTimer()
        webView.loadUrl(url)
    }

    private fun showError(detail: String) {
        val currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
        errorMsg.text = "접속 주소: $currentUrl\n오류 내용: $detail\n\n클라우드 서버 상태를 확인해주세요."
        errorLayout.visibility = View.VISIBLE
        webView.visibility = View.GONE
    }

    private fun showServerSettingsDialog() {
        val currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
        val input = EditText(this).apply {
            setText(currentUrl)
            hint = "예: https://party-games-cxo2.onrender.com"
            setSelection(text.length)
        }

        AlertDialog.Builder(this)
            .setTitle("게임 서버 주소 설정")
            .setMessage("기본 클라우드 주소:\nhttps://party-games-cxo2.onrender.com")
            .setView(input)
            .setPositiveButton("저장 및 접속") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    prefs.edit().putString(KEY_SERVER_URL, newUrl).apply()
                    loadGameUrl()
                }
            }
            .setNegativeButton("취소", null)
            .setNeutralButton("기본값 복원") { _, _ ->
                prefs.edit().putString(KEY_SERVER_URL, DEFAULT_SERVER_URL).apply()
                loadGameUrl()
            }
            .show()
    }

    private fun setupBackPress() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish()
                    } else {
                        backPressedTime = System.currentTimeMillis()
                        Toast.makeText(this@MainActivity, "한 번 더 누르면 앱이 종료됩니다", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    inner class AndroidBridgeInterface(private val context: Context) {
        @JavascriptInterface
        fun isApp(): Boolean = true

        @JavascriptInterface
        fun getVersion(): String = "1.0.3"

        @JavascriptInterface
        fun shareInvite(title: String, text: String, url: String) {
            runOnUiThread {
                try {
                    val sendIntent = Intent().apply {
                        action = Intent.ACTION_SEND
                        putExtra(Intent.EXTRA_TITLE, title)
                        putExtra(Intent.EXTRA_TEXT, "$text\n$url")
                        type = "text/plain"
                    }
                    val shareIntent = Intent.createChooser(sendIntent, "초대 링크 공유하기")
                    context.startActivity(shareIntent)
                } catch (e: Exception) {
                    Toast.makeText(context, "공유 실패: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun showNativeAd() {
            // 결제 & 광고 없는 100% 무료 VIP 개방
        }

        @JavascriptInterface
        fun requestInAppPurchase(productId: String) {
            // 결제 없는 100% 무료 VIP 개방
        }

        @JavascriptInterface
        fun openServerSettings() {
            runOnUiThread {
                showServerSettingsDialog()
            }
        }
    }
}
