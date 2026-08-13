# Офлайн-установка WSL2 на Windows 10 22H2

Пакет для машины **без интернета**: скопируйте всю папку `WSL` на флешку, на офлайн-ПК установите WSL2 и Ubuntu 22.04, затем настройте Docker Desktop на бэкенд WSL2.

Официальные источники пакетов (для повторной загрузки на машине с интернетом):

- WSL MSI: [microsoft/WSL releases](https://github.com/microsoft/WSL/releases) → `wsl.*.x64.msi`
- Legacy kernel: [wsl_update_x64.msi](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi)
- Ubuntu 22.04: [aka.ms/wslubuntu2204](https://aka.ms/wslubuntu2204)
- Документация Microsoft: [Manual install](https://learn.microsoft.com/en-us/windows/wsl/install-manual)

---

## 1. Требования (офлайн-ПК)

| Требование | Как проверить |
|------------|----------------|
| Windows 10 **22H2** (build ≥ 19041) | `Win+R` → `winver` |
| Архитектура **x64** | Параметры → Система → О системе |
| Права **Администратора** | PowerShell «от имени администратора» |
| Виртуализация в BIOS (**VT-x** / **AMD-V**) | Включённая; иначе ошибка `0x80370102` |
| Свободное место | ≥ **2 ГБ** на системном диске (+ запас под Docker) |

Проверка виртуализации в PowerShell:

```powershell
systeminfo | findstr /i "Hyper-V Виртуализац Virtualization"
```

Ожидается строка вроде «Обнаружена виртуализация на уровне встроенного ПО» / «A hypervisor has been detected» или поддержка виртуализации = Да.

---

## 2. Состав этой папки

```
WSL/
  OFFLINE_WSL_INSTALL.md     ← эта инструкция
  download-wsl-offline.ps1   ← скачать пакеты (только с интернетом)
  install-wsl-offline.ps1    ← установка на офлайн-ПК
  packages/
    wsl.2.7.11.0.x64.msi                     ← основной установщик WSL (предпочтительный)
    wsl_update_x64.msi                       ← запасное legacy-ядро
    Ubuntu2204.AppxBundle                    ← полный bundle Ubuntu 22.04 LTS (~1 ГБ)
    Ubuntu2204_x64.appx                      ← только x64 (~548 МБ; предпочтительно на Win10 x64)
    Microsoft.VCLibs.x64.14.00.Desktop.appx  ← обязательная зависимость Ubuntu appx (~6.5 МБ)
  checksums.txt              ← SHA256 файлов в packages/
```

Переносите **всю** папку `WSL` целиком.

---

## 3. Быстрый путь (рекомендуется)

### На машине с интернетом (уже сделано, если packages/ заполнен)

При необходимости обновить пакеты:

```powershell
cd D:\путь\к\Lake_grok\WSL
.\download-wsl-offline.ps1
```

### На офлайн-ПК

1. Скопируйте `WSL` на диск (например `D:\WSL`).
2. Откройте **PowerShell от имени Администратора**.
3. Выполните:

```powershell
cd D:\WSL
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install-wsl-offline.ps1
```

4. Если скрипт попросил перезагрузку после включения компонентов Windows — **перезагрузите ПК** и снова запустите:

```powershell
cd D:\WSL
.\install-wsl-offline.ps1 -AfterReboot
```

5. При первом запуске Ubuntu создайте пользователя Linux (логин/пароль).
6. Проверка:

```powershell
wsl -l -v
```

У Ubuntu в колонке `VERSION` должно быть **2**.

---

## 4. Ручная установка (по шагам)

### Шаг A — компоненты Windows (интернет не нужен)

PowerShell **Администратор**:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

**Перезагрузка** обязательна.

### Шаг B — установить WSL

Предпочтительно (современный пакет из GitHub):

```powershell
msiexec /i "D:\WSL\packages\wsl.2.7.11.0.x64.msi" /norestart
```

Если MSI сообщает, что пакет «не применим» / не подходит к этой сборке — поставьте запасной kernel:

```powershell
msiexec /i "D:\WSL\packages\wsl_update_x64.msi" /norestart
```

### Шаг C — WSL 2 по умолчанию

```powershell
wsl --set-default-version 2
```

### Альтернатива шагам D–F: восстановление Ubuntu из бэкапа (`wsl --import`)

Если на исходной машине уже настроен рабочий дистрибутив и сделан его экспорт (`wsl --export Ubuntu-22.04 D:\Backups\Ubuntu-22.04.tar`), можно перенести его на офлайн-ПК целиком вместо установки appx с нуля — быстрее и сохраняет пользователей/файлы/конфигурацию. **appx (Шаги D–E) и VCLibs в этом случае не нужны** — импортированный дистрибутив не появляется в Пуске как плитка и запускается только командой `wsl -d <имя>`.

```powershell
# Родительская папка должна существовать (саму конечную wsl создаёт сама):
New-Item -ItemType Directory -Path "C:\WSL" -Force

wsl --import Ubuntu-Restored "C:\WSL\Ubuntu" "D:\Backups\Ubuntu-22.04.tar" --version 2
```

Проверка и первый запуск:

```powershell
wsl -l -v
wsl -d Ubuntu-Restored
```

Типичные ошибки — см. §6.5 (`не удаётся найти указанный путь`) и §6.6 (ошибка ActiveX/`mstscax.dll` при запуске импортированного дистрибутива).

Если импорт прошёл успешно — переходите сразу к [разделу 5 (Docker Desktop + WSL2)](#5-docker-desktop--wsl2), шаги D–F ниже не нужны.

### Шаг D — зависимость VCLibs (обязательно, иначе Ubuntu молча не запустится)

```powershell
cd D:\WSL\packages
Add-AppxPackage .\Microsoft.VCLibs.x64.14.00.Desktop.appx
```

Без этого рантайма пакет Ubuntu устанавливается без ошибок, но при запуске **ничего не происходит** (плитка в Пуск не открывает окно) либо появляется ошибка файловой системы `12007`.

### Шаг E — Ubuntu 22.04

```powershell
cd D:\WSL\packages
# Предпочтительно x64-пакет (меньше и без ARM):
Add-AppxPackage .\Ubuntu2204_x64.appx
# либо полный bundle:
# Add-AppxPackage .\Ubuntu2204.AppxBundle
```

Запустите **Ubuntu из меню Пуск обычным кликом, БЕЗ «Запуск от имени администратора»** — первичная настройка (создание пользователя) от администратора часто падает с ошибкой `12007`. Дождитесь распаковки, создайте пользователя.

Если дистрибутив остался на WSL 1:

```powershell
wsl --set-version Ubuntu-22.04 2
# или имя из вывода: wsl -l -v
```

### Шаг F — проверка

```powershell
wsl -l -v
wsl -e uname -a
```

### Шаг G (альтернатива шагу E) — импорт Ubuntu из backup (`wsl --import`)

Если есть готовый экспорт дистрибутива (`.tar`), можно **не** ставить appx из Store, а восстановить систему через `wsl --import`. VCLibs (шаг D) для этого пути не нужен; компоненты Windows + MSI (шаги A–C) — обязательны.

1. Убедиться, что backup-файл существует, и создать родительскую папку назначения (сам `--import` создаёт только **последний** каталог):

```powershell
Test-Path "D:\Backups\Ubuntu-22.04.tar"
New-Item -ItemType Directory -Path "C:\WSL" -Force
```

2. Импорт (имя дистрибутива, папка данных, путь к tar, версия WSL 2):

```powershell
wsl --import Ubuntu-Restored "C:\WSL\Ubuntu" "D:\Backups\Ubuntu-22.04.tar" --version 2
```

Параметры по порядку:
- `Ubuntu-Restored` — имя дистрибутива в `wsl -l -v` (можно любое);
- `C:\WSL\Ubuntu` — каталог, куда WSL положит `ext4.vhdx`;
- `D:\Backups\Ubuntu-22.04.tar` — исходный архив (`wsl --export` с другой машины);
- `--version 2` — сразу зарегистрировать как WSL2.

3. Проверка и запуск:

```powershell
wsl -l -v
wsl -d Ubuntu-Restored
```

Сделать импортированный дистрибутив дистрибутивом по умолчанию:

```powershell
wsl --set-default Ubuntu-Restored
```

Если при запуске появляется ошибка ActiveX / `mstscax.dll` — см. §6.6 (отключить WSLg). Если «не удается найти указанный путь» — см. §6.5.

> **Примечание.** Экспорт с исходной машины (где Ubuntu уже работает):  
> `wsl --export Ubuntu-22.04 D:\Backups\Ubuntu-22.04.tar`  
> (имя возьмите из `wsl -l -v` на исходном ПК).

---

## 5. Docker Desktop + WSL2

После успешного `wsl -l -v` с VERSION=2:

1. Установите Docker Desktop (отдельный установщик; в этот пакет WSL он не входит).
2. Docker Desktop → **Settings** → **General** → включите **Use the WSL 2 based engine**.
3. **Resources** → **WSL Integration** → включите нужный дистрибутив (Ubuntu).
4. **Resources** → **Advanced** (или Limits) — память VM:
   - основной офлайн-сервер InfoLake: **12–16 GB**
   - ноутбук 8 GB: не больше **4–5 GB**, плюс сниженные `mem_limit` в `docker-compose.yml`

Перезапустите Docker Desktop, затем поднимайте InfoLake как в `OFFLINE_DEPLOY_PROD.md` / `OFFLINE_DEPLOY_DEV.md`.

---

## 6. Типичные ошибки

| Симптом | Что делать |
|---------|------------|
| `0x80370102` / VM could not be started | В BIOS включить VT-x/AMD-V; отключить конфликтующие гипервизоры (другие VM); после включения компонентов — reboot |
| `wsl_update_x64.msi` «не применим» | Нормально на части сборок 22H2 — ставьте `wsl.2.7.11.0.x64.msi` из GitHub |
| `Add-AppxPackage` ругается на зависимости | Нужны VCLibs / UI.Xaml — см. раздел 7; либо распакуйте `.appx` как zip (метод Server) |
| `wsl` не найден после MSI | Перезагрузка; новый PowerShell; проверить `C:\Windows\System32\wsl.exe` |
| Ubuntu VERSION=1 | `wsl --set-version <Имя> 2` |
| Docker всё ещё Hyper-V backend | В Settings явно включить WSL 2 based engine и перезапустить Docker |
| `msiexec` «Не удалось открыть пакет» (1619) | См. §6.1 — абсолютный путь, SHA256, Unblock-File |
| Ошибка файловой системы `12007` | См. §6.2 — не запускать Ubuntu от администратора |
| Плитка Ubuntu в Пуске молчит | См. §6.4 — сначала поставить VCLibs |
| `wsl --import` «не удается найти путь» | См. §6.5 / шаг G в §4 — проверить tar и родительскую папку |
| ActiveX / `mstscax.dll` при запуске Ubuntu | См. §6.6 — отключить WSLg через `.wslconfig` |

Проверка статуса компонентов:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux
Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
```

Оба должны быть **Enabled**.

### 6.1. `msiexec`: «Не удалось открыть этот пакет установки» (код 1619)

```
Не удалось открыть этот пакет установки. Убедитесь что пакет существует
и у вас есть к нему доступ, или обратитесь к поставщику приложения...
```

Причины (по частоте):

1. **Относительный путь без кавычек** (`.\packages\wsl...msi`) — самая частая причина именно этой формулировки у `msiexec`. Использовать абсолютный путь в кавычках:
   ```powershell
   cd D:\WSL
   msiexec /i "D:\WSL\packages\wsl.2.7.11.0.x64.msi" /norestart
   ```
2. **Файл повреждён/не докопирован** при переносе на офлайн-ПК — сверить хэш:
   ```powershell
   Get-FileHash "D:\WSL\packages\wsl.2.7.11.0.x64.msi" -Algorithm SHA256
   Get-Content "D:\WSL\checksums.txt"
   ```
   При несовпадении — скопировать файл заново.
3. **Файл заблокирован Windows** (Mark-of-the-Web):
   ```powershell
   Get-Item "D:\WSL\packages\wsl.2.7.11.0.x64.msi" -Stream Zone.Identifier -ErrorAction SilentlyContinue
   Unblock-File -Path "D:\WSL\packages\wsl.2.7.11.0.x64.msi"
   ```
4. **Скрытое второе расширение** (файл на самом деле `wsl....msi.something`) — проверить реальное имя и размер:
   ```powershell
   Get-ChildItem "D:\WSL\packages" | Format-List Name, Length, Extension
   ```
5. Если ничего не помогло — снять подробный лог и посмотреть точную причину:
   ```powershell
   msiexec /i "D:\WSL\packages\wsl.2.7.11.0.x64.msi" /norestart /L*V C:\wsl_install.log
   notepad C:\wsl_install.log
   ```
   В конце лога ищите строки `Error` / `Return value 3`.

### 6.2. Ubuntu: ошибка файловой системы `12007` при первом запуске

Частые причины, по порядку проверки:

1. **Первый запуск выполнен от имени администратора.** UAC-виртуализация ломает первичную настройку файловой системы внутри WSL. Закройте окно и запустите Ubuntu **обычным (не admin) кликом** из меню Пуск.
2. **`wsl --set-default-version 2` не применился** (WSL MSI не до конца установился) — проверить:
   ```powershell
   wsl --status
   ```
   Если ошибка — сначала почините MSI (см. §6.1), потом возвращайтесь к Ubuntu.
3. **Сжатие NTFS включено** для папки пакета Ubuntu — известный баг, ломает монтирование ext4-диска:
   ```powershell
   $pkg = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Filter "CanonicalGroupLimited.Ubuntu*" -Directory
   compact /U /S:"$($pkg.FullName)" /A
   ```
4. Если не помогло — переустановить дистрибутив с нуля:
   ```powershell
   wsl --unregister Ubuntu-22.04
   Get-AppxPackage CanonicalGroupLimited.Ubuntu* | Remove-AppxPackage
   cd D:\WSL\packages
   Add-AppxPackage .\Ubuntu2204_x64.appx
   ```
   Затем запустить Ubuntu из Пуск **без администратора**.

### 6.3. `wsl -l -v` → «Подсистема Linux для Windows не имеет установленных дистрибутивов»

Appx-пакет установлен, но регистрация дистрибутива (первичная настройка) ещё ни разу не завершилась успешно. `wsl -d <имя>` тут не поможет — саму регистрацию делает только лаунчер приложения. Запустите (без администратора):

```powershell
& "$env:LOCALAPPDATA\Microsoft\WindowsApps\ubuntu2204.exe"
```

либо кликните по плитке **Ubuntu 22.04.x LTS** в Пуске. Если падает на `12007` — см. §6.2.

### 6.4. Клик по плитке Ubuntu в Пуске — «ничего не происходит» (нет окна, нет ошибки)

Типичный симптом отсутствующей зависимости **VCLibs** (`Microsoft.VCLibs.140.00.UWPDesktop`) — appx устанавливается без ошибок, но тихо не активируется. Проверка и фикс:

```powershell
# 1. Есть ли VCLibs и в порядке ли зависимости
Get-AppxPackage -Name "Microsoft.VCLibs.140.00.UWPDesktop"
(Get-AppxPackage -Name "CanonicalGroupLimited.Ubuntu*").Dependencies | Select Name, Version, Status

# 2. Запустить exe напрямую (не с плитки) — покажет реальную ошибку в консоли
$loc = (Get-AppxPackage -Name "CanonicalGroupLimited.Ubuntu*").InstallLocation
& "$loc\ubuntu2204.exe"
```

Если `Microsoft.VCLibs.140.00.UWPDesktop` не установлен — поставить его **до** Ubuntu (пакет уже лежит в `packages\`, начиная с этой версии инструкции):

```powershell
cd D:\WSL\packages
Add-AppxPackage .\Microsoft.VCLibs.x64.14.00.Desktop.appx
Add-AppxPackage .\Ubuntu2204_x64.appx
```

`install-wsl-offline.ps1` теперь делает это автоматически перед установкой Ubuntu.

### 6.5. `wsl --import` → «Не удается найти указанный путь»

Относится либо к исходному tar-файлу, либо к папке назначения:

```powershell
# 1. Убедиться, что backup реально существует по указанному пути
Test-Path "D:\Backups\Ubuntu-22.04.tar"
Get-ChildItem "D:\Backups\" -Filter "*.tar*"

# 2. wsl --import создаёт только последнюю папку в пути, родительская должна существовать
Test-Path "C:\WSL"
New-Item -ItemType Directory -Path "C:\WSL" -Force

# 3. Убедиться, что сам wsl.exe рабочий (см. §6.1, если ошибка)
wsl --status
```

Повторить с исправленными путями:

```powershell
wsl --import Ubuntu-Restored "C:\WSL\Ubuntu" "D:\Backups\Ubuntu-22.04.tar" --version 2
```

### 6.6. Запуск дистрибутива → «Не удалось загрузить управляющий элемент ActiveX служб удаленных рабочих столов» (`mstscax.dll`)

Современный `wsl.exe` при старте **любого** дистрибутива поднимает в фоне **WSLg** (поддержка Linux GUI-приложений), которая использует Windows-компонент RDP (`mstscax.dll`) для связи Linux↔Windows — даже если запускается обычная консоль без единого GUI-приложения. Если `mstscax.dll` в системе повреждён/несовместим, вылезает эта ошибка. Так как для Docker WSLg не нужен, проще всего отключить его целиком:

```powershell
notepad "$env:USERPROFILE\.wslconfig"
```

Добавить (создать файл, если его нет):

```ini
[wsl2]
guiApplications=false
```

Перезапустить WSL и попробовать снова:

```powershell
wsl --shutdown
wsl -d Ubuntu-Restored
```

Если ошибка сохраняется — проблема на уровне самой ОС (`mstscax.dll` повреждён независимо от WSL):

```powershell
regsvr32 C:\Windows\System32\mstscax.dll
sfc /scannow
```

(`DISM /Online /Cleanup-Image /RestoreHealth` на офлайн-машине без доступа к Windows Update не сработает без локального источника `install.wim`/`install.esd`).

---

## 7. Зависимости Appx

Пакет Ubuntu 22.04 требует единственную зависимость — `Microsoft.VCLibs.140.00.UWPDesktop` (MinVersion 14.0.24217.0), проверено по `AppxManifest.xml` внутри `Ubuntu2204_x64.appx`. UI.Xaml **не требуется** (Ubuntu — консольное приложение, `--ui=none`).

Начиная с этой версии инструкции файл `Microsoft.VCLibs.x64.14.00.Desktop.appx` уже лежит в `packages/`, а `install-wsl-offline.ps1` ставит его автоматически перед Ubuntu. Ручная установка (если нужно повторить или обновить):

```powershell
cd D:\WSL\packages
Add-AppxPackage .\Microsoft.VCLibs.x64.14.00.Desktop.appx
Add-AppxPackage .\Ubuntu2204_x64.appx
```

Если в будущем понадобится другой дистрибутив с зависимостью на `Microsoft.UI.Xaml.*` — скачать `.appx` на машине **с интернетом** (Microsoft Store CDN / winget), положить в `packages/` и поставить в том же порядке (сначала зависимости, потом сам дистрибутив).

Альтернатива без Store (метод Windows Server): переименовать `.appx` → `.zip`, распаковать, найти вложенный `.appx` под вашу архитектуру, установить его.

Пересобрать список актуальных зависимостей для любого appx можно так:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("D:\WSL\packages\Ubuntu2204_x64.appx")
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'AppxManifest.xml' }
[System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, "$env:TEMP\manifest.xml", $true)
$zip.Dispose()
Get-Content "$env:TEMP\manifest.xml" -Raw
```

---

## 8. Повторная загрузка пакетов (онлайн-машина)

```powershell
cd <путь>\WSL
.\download-wsl-offline.ps1
Get-Content .\checksums.txt
```

Сверьте SHA256 с `checksums.txt` после копирования на офлайн-ПК:

```powershell
Get-FileHash .\packages\* -Algorithm SHA256
```

---

## 9. Чек-лист перед Docker / InfoLake

- [ ] `winver` — 22H2, build ≥ 19041  
- [ ] Компоненты WSL и VirtualMachinePlatform = Enabled  
- [ ] Установлен `wsl.*.x64.msi` (или legacy kernel)  
- [ ] Установлен `Microsoft.VCLibs.x64.14.00.Desktop.appx` (до Ubuntu appx; не нужен при `wsl --import`)  
- [ ] Ubuntu установлен: либо appx + первый запуск **без администратора**, либо `wsl --import` из `.tar` (см. §4 шаг G)  
- [ ] При ошибке ActiveX/WSLg: в `%USERPROFILE%\.wslconfig` задано `guiApplications=false`  
- [ ] `wsl -l -v` показывает Ubuntu с VERSION **2**  
- [ ] Docker Desktop → WSL 2 based engine  
- [ ] Память Docker согласована с ОЗУ хоста  
- [ ] InfoLake: `docker compose ... up -d --no-build --pull never`