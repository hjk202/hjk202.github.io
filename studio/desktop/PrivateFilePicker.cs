namespace PersonalSpaceStudio;

// Only the native top-level message handler invokes this selector. No browser-provided path.
internal static class PrivateFilePicker
{
    internal static string? Select(IWin32Window owner, string mode)
    {
        using FileDialog dialog = mode == "open"
            ? new OpenFileDialog { Multiselect = false, ShowPreview = false, CheckFileExists = true }
            : mode is "create" or "export" ? new SaveFileDialog { OverwritePrompt = false, CheckFileExists = false }
            : throw new InvalidOperationException();
        dialog.Title = mode == "open" ? "打开私人资料库（仓库外）" : mode == "export" ? "选择网站更新文件位置（仓库外的新文件）" : "新建私人资料库（仓库外的新文件）";
        dialog.Filter = "加密资料文件 (*.json)|*.json";
        dialog.DefaultExt = "json"; dialog.AddExtension = true; dialog.CheckPathExists = true;
        dialog.AddToRecent = false; dialog.RestoreDirectory = true; dialog.DereferenceLinks = false;
        return dialog.ShowDialog(owner) == DialogResult.OK ? dialog.FileName : null;
    }
}
