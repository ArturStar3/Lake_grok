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
    wsl.2.7.11.0.x64.msi     ← основной установщик WSL (предпочтительный)
    wsl_update_x64.msi       ← запасное legacy-ядро
    Ubuntu2204.AppxBundle    ← полный bundle Ubuntu 22.04 LTS (~1 ГБ)
    Ubuntu2204_x64.appx      ← только x64 (~548 МБ; предпочтительно на Win10 x64)
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

### Шаг D — Ubuntu 22.04

```powershell
cd D:\WSL\packages
# Предпочтительно x64-пакет (меньше и без ARM):
Add-AppxPackage .\Ubuntu2204_x64.appx
# либо полный bundle:
# Add-AppxPackage .\Ubuntu2204.AppxBundle
```

Запустите **Ubuntu** из меню Пуск, дождитесь распаковки, создайте пользователя.

Если дистрибутив остался на WSL 1:

```powershell
wsl --set-version Ubuntu-22.04 2
# или имя из вывода: wsl -l -v
```

### Шаг E — проверка

```powershell
wsl -l -v
wsl -e uname -a
```

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

Проверка статуса компонентов:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux
Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
```

Оба должны быть **Enabled**.

---

## 7. Зависимости Appx (если Ubuntu не ставится)

Иногда `Add-AppxPackage` требует:

- `Microsoft.VCLibs.x64.*.appx`
- `Microsoft.UI.Xaml.*.appx`

Их нужно скачать на машине **с интернетом** (Microsoft Store CDN / winget) и положить в `packages/`, затем:

```powershell
Add-AppxPackage .\Microsoft.VCLibs.*.appx
Add-AppxPackage .\Microsoft.UI.Xaml.*.appx
Add-AppxPackage .\Ubuntu2204.appx
```

Альтернатива без Store (метод Windows Server): переименовать `.appx` → `.zip`, распаковать, найти вложенный `.appx` под вашу архитектуру, установить его.

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
- [ ] `wsl -l -v` показывает Ubuntu с VERSION **2**  
- [ ] Docker Desktop → WSL 2 based engine  
- [ ] Память Docker согласована с ОЗУ хоста  
- [ ] InfoLake: `docker compose ... up -d --no-build --pull never`
