using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
namespace FigmaGifAssistant;
public partial class ThemeDialog:Window {
 public ThemeDialog(Window? owner,string title,string message,string confirm,bool destructive=false){
  InitializeComponent();if(owner!=null){if(owner.IsVisible)Owner=owner;FontFamily=owner.FontFamily;foreach(var key in new[]{"Canvas","Text","Muted","Divider","Control","Hover","Brand"})Resources[key]=owner.FindResource(key);}else WindowStartupLocation=WindowStartupLocation.CenterScreen;
  Title=title;Heading.Text=title;Message.Text=message;ConfirmButton.Content=confirm;
  if(destructive){ConfirmButton.Background=new SolidColorBrush(Color.FromRgb(229,61,44));ConfirmButton.Foreground=Brushes.White;}
  Loaded+=(_,_)=>{if(CancelButton.Visibility==Visibility.Visible)CancelButton.Focus();else ConfirmButton.Focus();};
 }
 void DragHeader(object sender,MouseButtonEventArgs e){if(e.ChangedButton!=MouseButton.Left)return;for(var node=e.OriginalSource as DependencyObject;node!=null;node=VisualTreeHelper.GetParent(node)){if(node is System.Windows.Controls.Button)return;if(node==sender)break;}try{DragMove();}catch(InvalidOperationException){}}
 void Cancel(object sender,RoutedEventArgs e)=>DialogResult=false;
 void Confirm(object sender,RoutedEventArgs e)=>DialogResult=true;
 public static bool Ask(Window owner,string title,string message,string confirm,bool destructive=false){
  var dialog=new ThemeDialog(owner,title,message,confirm,destructive);var content=owner.Content as UIElement;double opacity=content?.Opacity??1;
  try{if(content!=null)content.Opacity=.6;return dialog.ShowDialog()==true;}finally{if(content!=null)content.Opacity=opacity;}
 }
 public static void ShowError(string message){var dialog=new ThemeDialog(null,"无法启动助手",message,"关闭");dialog.CancelButton.Visibility=Visibility.Collapsed;dialog.CancelButton.IsDefault=false;dialog.ConfirmButton.IsDefault=true;dialog.ShowDialog();}
}

