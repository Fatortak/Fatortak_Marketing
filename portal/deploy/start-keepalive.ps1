$node = 'C:\Program Files\nodejs\node.exe'
$script = 'D:\Inetpub\vhosts\rabeh.store\fatortak.rabbeh.com\App_Data\portal-app\keepalive.mjs'
$commandLine = '"' + $node + '" "' + $script + '"'
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine } | ConvertTo-Json -Compress
