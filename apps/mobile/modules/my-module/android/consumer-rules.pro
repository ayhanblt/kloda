-keep class com.kloda.sync.KlodaPairingJni { native <methods>; }
-keep class com.kloda.sync.KlodaPairingPlatform { *; }
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
-keep class com.kloda.sync.FtpsNativeEngine { native <methods>; }
-keep interface com.kloda.sync.FtpsNativeReceipt { *; }
-keepclassmembers class * implements com.kloda.sync.FtpsNativeReceipt {
  public int onEvent(int,long);
  public int connect(java.lang.String,int);
}
-keep class com.kloda.sync.S3NativeEngine { native <methods>; }
