plugins {
  alias(libs.plugins.android.application)
}

android {
  namespace = "com.partygamesapp"
  compileSdk = 36
  defaultConfig {
    applicationId = "com.partygamesapp"
    minSdk = 24
    targetSdk = 36
    versionCode = 1
    versionName = "1.0"
  }

  signingConfigs {
    create("release") {
      storeFile = file("partygames-release.jks")
      storePassword = "partygames1234!"
      keyAlias = "partygames"
      keyPassword = "partygames1234!"
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      signingConfig = signingConfigs.getByName("release")
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildFeatures {
    compose = false
    aidl = false
    buildConfig = false
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.lifecycle.runtime.ktx)

  // Google AdMob (전면 광고)
  implementation("com.google.android.gms:play-services-ads:23.6.0")

  // Google Play Billing (인앱결제 / 정기구독)
  implementation("com.android.billingclient:billing-ktx:7.1.1")
}

