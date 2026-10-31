-keep class com.kloda.sync.SmbNativeEngine { native <methods>; }
-keep interface com.kloda.sync.SmbNativeReceipt { *; }
-keepclassmembers class * implements com.kloda.sync.SmbNativeReceipt {
  public int onEvent(int,long);
}
