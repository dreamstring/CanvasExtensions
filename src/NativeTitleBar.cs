using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
namespace FigmaGifAssistant;
internal static class NativeTitleBar {
 [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(nint handle,int attribute,ref int value,int size);
 static int ColorRef(Color c)=>c.R|(c.G<<8)|(c.B<<16);
 public static object? Apply(Window window,bool light){
  var handle=new WindowInteropHelper(window).Handle;if(handle==0)return null;
  int dark=light?0:1,caption=ColorRef(((SolidColorBrush)window.FindResource("Canvas")).Color),text=ColorRef(((SolidColorBrush)window.FindResource("Text")).Color);
  int darkResult=DwmSetWindowAttribute(handle,20,ref dark,4);
  int captionResult=DwmSetWindowAttribute(handle,35,ref caption,4);
  int textResult=DwmSetWindowAttribute(handle,36,ref text,4);
  return new {darkResult,captionResult,textResult,captionColor=caption,textColor=text};
 }
 public static object? Inspect(Window window,bool light){new WindowInteropHelper(window).EnsureHandle();return Apply(window,light);}
}
