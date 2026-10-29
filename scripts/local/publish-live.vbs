' 작업 스케줄러가 5분마다 부른다. 창이 깜빡이지 않게 숨겨서 돌리고, 마지막 결과는 out\publish.log 에 남긴다.
Dim fso, root, sh
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = root
If Not fso.FolderExists(root & "\out") Then fso.CreateFolder(root & "\out")
sh.Run "cmd /c """"C:\Program Files\nodejs\node.exe"" scripts\publish-live.mjs > out\publish.log 2>&1""", 0, True
