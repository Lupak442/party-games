package com.partygames.host

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
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
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

class MainActivity : ComponentActivity(), PurchasesUpdatedListener {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorLayout: LinearLayout
    private lateinit var errorMsg: TextView
    private lateinit var btnRetry: Button
    private lateinit var btnSettings: Button
    private lateinit var prefs: SharedPreferences

    // Google AdMob
    private var interstitialAd: InterstitialAd? = null
    private var isLoadingAd: Boolean = false

    // Google Play Billing
    private lateinit var billingClient: BillingClient

    private var backPressedTime: Long = 0

    companion object {
        private const val PREFS_NAME = "PartyGamesHostPrefs"
        private const val KEY_SERVER_URL = "server_url"
        // 10.0.2.2는 안드로이드 에뮬레이터에서 PC의 localhost:3000에 접속하는 공식 루프백 주소입니다.
        const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000"
        // 구글 AdMob 공식 전면 테스트 광고 단위 ID
        const val TEST_INTERSTITIAL_AD_ID = "ca-app-pub-3940256099942544/1033173712"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // 게임의 다크 테마(#070514)에 맞춰 상태바 및 내비게이션바 색상 일체화
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.parseColor("#070514")
        window.navigationBarColor = Color.parseColor("#070514")
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false

        setupUI()
        setupWebView()
        setupBackPress()

        // 1. Google AdMob 초기화 & 첫 번째 광고 미리 로드
        initAdMob()

        // 2. Google Play Billing 초기화
        initBilling()

        loadGameUrl()
    }

    /* ---- 1. Google AdMob 초기화 및 전면 광고 로드 ---- */
    private fun initAdMob() {
        MobileAds.initialize(this) {
            loadInterstitialAd()
        }
    }

    private fun loadInterstitialAd() {
        if (isLoadingAd || interstitialAd != null) return
        isLoadingAd = true

        val adRequest = AdRequest.Builder().build()
        InterstitialAd.load(
            this,
            TEST_INTERSTITIAL_AD_ID,
            adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    isLoadingAd = false
                    setupAdCallbacks()
                }

                override fun onAdFailedToLoad(loadAdError: LoadAdError) {
                    interstitialAd = null
                    isLoadingAd = false
                }
            }
        )
    }

    private fun setupAdCallbacks() {
        interstitialAd?.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                interstitialAd = null
                notifyAdCompleted()
                loadInterstitialAd() // 다음 판을 위해 미리 백그라운드 프리로드
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                interstitialAd = null
                notifyAdCompleted()
                loadInterstitialAd()
            }
        }
    }

    private fun showNativeAd() {
        runOnUiThread {
            if (interstitialAd != null) {
                interstitialAd?.show(this)
            } else {
                // 광고가 아직 로드되지 않았거나 네트워크 지연 시 딜레이 없이 바로 게임 시작
                notifyAdCompleted()
                loadInterstitialAd()
            }
        }
    }

    private fun notifyAdCompleted() {
        webView.evaluateJavascript(
            "if (window.Local && typeof Local.onNativeAdComplete === 'function') { Local.onNativeAdComplete(); }",
            null
        )
    }

    /* ---- 2. Google Play Billing 초기화 및 인앱결제 처리 ---- */
    private fun initBilling() {
        val pendingParams = PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()

        billingClient = BillingClient.newBuilder(this)
            .setListener(this)
            .enablePendingPurchases(pendingParams)
            .build()

        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                // Billing 연결 성공
            }

            override fun onBillingServiceDisconnected() {
                // 필요 시 재연결
            }
        })
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                handlePurchase(purchase)
            }
        } else if (billingResult.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            Toast.makeText(this, "결제가 취소되었습니다.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            if (!purchase.isAcknowledged) {
                val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
                billingClient.acknowledgePurchase(acknowledgePurchaseParams) { billingResult ->
                    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                        notifyPurchaseSuccess()
                    }
                }
            } else {
                notifyPurchaseSuccess()
            }
        }
    }

    private fun notifyPurchaseSuccess() {
        runOnUiThread {
            Toast.makeText(this, "👑 프리미엄 멤버십이 활성화되었습니다!", Toast.LENGTH_LONG).show()
            webView.evaluateJavascript(
                "if (window.Local && typeof Local.onNativePurchaseSuccess === 'function') { Local.onNativePurchaseSuccess('premium_monthly'); }",
                null
            )
        }
    }

    /* ---- 3. UI 및 웹뷰 세팅 ---- */
    private fun setupUI() {
        val root = android.widget.FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#070514"))
        }

        webView = WebView(this).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#070514"))
        }
        root.addView(webView)

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                10
            )
            isIndeterminate = false
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#f59e0b"))
            visibility = View.GONE
        }
        root.addView(progressBar)

        // 오프라인 / 서버 연결 실패 화면
        errorLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setPadding(48, 48, 48, 48)
            visibility = View.GONE
            setBackgroundColor(Color.parseColor("#0d0b24"))
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )

            val icon = TextView(this@MainActivity).apply {
                text = "👑🎲"
                textSize = 48f
                gravity = android.view.Gravity.CENTER
            }
            addView(icon)

            val title = TextView(this@MainActivity).apply {
                text = "파티 게임즈 서버 연결 실패"
                textSize = 20f
                setTextColor(Color.WHITE)
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                gravity = android.view.Gravity.CENTER
                setPadding(0, 24, 0, 8)
            }
            addView(title)

            errorMsg = TextView(this@MainActivity).apply {
                text = "서버가 켜져 있는지 확인해주세요."
                textSize = 14f
                setTextColor(Color.parseColor("#94a3b8"))
                gravity = android.view.Gravity.CENTER
                setPadding(0, 0, 0, 32)
            }
            addView(errorMsg)

            btnRetry = Button(this@MainActivity).apply {
                text = "다시 시도 🔄"
                setBackgroundColor(Color.parseColor("#8b5cf6"))
                setTextColor(Color.WHITE)
                setOnClickListener { loadGameUrl() }
            }
            addView(btnRetry)

            btnSettings = Button(this@MainActivity).apply {
                text = "서버 주소 변경 ⚙️"
                setBackgroundColor(Color.parseColor("#1e1b4b"))
                setTextColor(Color.parseColor("#fbbf24"))
                setOnClickListener { showServerSettingsDialog() }
            }
            addView(btnSettings)
        }
        root.addView(errorLayout)

        setContentView(root)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.allowFileAccess = true
        s.allowContentAccess = true
        s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        s.userAgentString = s.userAgentString + " PartyGamesHostApp/1.0"
        s.mediaPlaybackRequiresUserGesture = false

        // 네이티브 브릿지 등록 (웹 JavaScript에서 window.AndroidBridge로 호출)
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
                errorLayout.visibility = View.GONE
                injectHostAppFlags()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                injectHostAppFlags()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showError(error?.description?.toString() ?: "연결 오류")
                }
            }
        }
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
        webView.loadUrl(url)
    }

    private fun showError(detail: String) {
        val currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
        errorMsg.text = "접속 주소: $currentUrl\n오류 내용: $detail\n\nPC에서 node server/index.js가 실행 중인지 확인해주세요."
        errorLayout.visibility = View.VISIBLE
        webView.visibility = View.GONE
    }

    private fun showServerSettingsDialog() {
        val currentUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)
        val input = EditText(this).apply {
            setText(currentUrl)
            hint = "예: http://10.0.2.2:3000 또는 http://192.168.0.5:3000"
            setSelection(text.length)
        }

        AlertDialog.Builder(this)
            .setTitle("게임 서버 주소 설정")
            .setMessage("에뮬레이터: http://10.0.2.2:3000\n실제 스마트폰(같은 Wi-Fi): http://내PC의IP:3000\n클라우드: https://내도메인")
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
        fun getVersion(): String = "1.0.0"

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

        // 네이티브 구글 AdMob 전면 광고 요청
        @JavascriptInterface
        fun showNativeAd() {
            this@MainActivity.showNativeAd()
        }

        // 네이티브 구글 플레이 인앱결제 요청
        @JavascriptInterface
        fun requestInAppPurchase(productId: String) {
            runOnUiThread {
                Toast.makeText(context, "구글 플레이 결제창 연결 중… ($productId)", Toast.LENGTH_SHORT).show()
                // 실제 출시 시 queryProductDetails & launchBillingFlow 수행. 테스트용으로 즉시 승인 시뮬레이션:
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("👑 프리미엄 멤버십 구독 (테스트)")
                    .setMessage("월 2,900원 결제를 진행하시겠습니까?\n(테스트 환경에서는 즉시 VIP가 적용됩니다)")
                    .setPositiveButton("결제 완료") { _, _ ->
                        notifyPurchaseSuccess()
                    }
                    .setNegativeButton("취소", null)
                    .show()
            }
        }

        @JavascriptInterface
        fun openServerSettings() {
            runOnUiThread {
                showServerSettingsDialog()
            }
        }
    }
}
