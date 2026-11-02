-keep class com.kloda.sync.SmbNativeEngine { native <methods>; }
-keep interface com.kloda.sync.SmbNativeReceipt { *; }
-keepclassmembers class * implements com.kloda.sync.SmbNativeReceipt {
  public int onEvent(int,long);
}
-keep class com.kloda.sync.SftpNativeEngine { native <methods>; }
-keep interface com.kloda.sync.SftpNativeReceipt { *; }
-keepclassmembers class * implements com.kloda.sync.SftpNativeReceipt {
  public int onEvent(int,long);
}
