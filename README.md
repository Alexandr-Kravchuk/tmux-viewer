# tmux-viewer

Локальний веб-інтерфейс для перегляду tmux сесій з live preview вмісту панелей.

![tmux-viewer](https://img.shields.io/badge/Go-1.26+-00ADD8?style=flat&logo=go)

## Особливості

- 📊 **Grid layout** - всі сесії на одному екрані
- 🔄 **Live updates** - автоматичне оновлення вмісту кожні 2 секунди через WebSocket
- 🎨 **Terminal-style UI** - монохромний дизайн у стилі терміналу
- 🚀 **Standalone binary** - один виконуваний файл без залежностей
- 👁️ **Preview панелей** - перегляд вмісту всіх панелей одночасно
- 🌈 **ANSI Color Support** - повноцінна підсвітка кольорів терміналу
- ⌘ **Open in iTerm2** - відкриття сесії в iTerm2 одним кліком
- 🗑️ **Kill Session** - можливість завершити сесію з підтвердженням
- ✎ **Rename Session** - можливість перейменувати сесію

## Вимоги

- Go 1.26+ (для компіляції)
- tmux (встановлений і запущений)
- Сучасний браузер з підтримкою WebSocket

## Встановлення

### Компіляція з вихідного коду

```bash
cd ~/Projects/tmux-viewer
./build.sh
```

Або вручну:

```bash
go build -o tmux-viewer
```

## Використання

### Керування сервером (рекомендовано)

Використовуйте control script для зручного керування:

```bash
# Запустити сервер в фоні
./tmux-viewer-ctl.sh start

# Відкрити в браузері
./tmux-viewer-ctl.sh open

# Перевірити статус
./tmux-viewer-ctl.sh status

# Зупинити сервер
./tmux-viewer-ctl.sh stop

# Перезапустити
./tmux-viewer-ctl.sh restart
```

### Альтернативно: запуск вручну

```bash
./tmux-viewer
```

Сервер запуститься на `http://localhost:8888`

Відкрити веб-інтерфейс:

```bash
open http://localhost:8888
```

Зупинити: натисніть `Ctrl+C` в терміналі де запущено сервер.

## Можливості інтерфейсу

### Управління сесіями

**Open in iTerm2 (⌘)**
- Натисніть іконку команди біля назви сесії
- Сесія відкриється в новій вкладці iTerm2
- Автоматичне підключення через `tmux attach`

**Rename Session (✎)**
- Натисніть іконку олівця біля назви сесії
- Введіть нову назву в prompt dialog
- Сесія буде перейменована без перезавантаження

**Kill Session (🗑)**
- Натисніть іконку корзини біля назви сесії
- Підтвердіть видалення в modal dialog
- Сесія буде завершена і видалена з списку

### Перегляд панелей

- **ANSI Colors** - автоматична підсвітка кольорів терміналу
- **Live Updates** - вміст оновлюється кожні 2 секунди
- **Auto-scroll** - автоматичний скрол для активних панелей
- **Responsive grid** - адаптується до розміру екрану

## API Endpoints

Якщо потрібно інтегрувати з іншими інструментами:

- `GET /api/sessions` - список всіх tmux сесій
- `GET /api/session/:id` - деталі конкретної сесії
- `GET /api/pane/:id/content?lines=50&colors=true` - вміст панелі (з кольорами за замовчуванням)
- `DELETE /api/session/:id` - завершити сесію
- `PUT /api/session/:id/rename` - перейменувати сесію (body: `{"new_name": "string"}`)
- `POST /api/session/:name/open-iterm` - відкрити сесію в iTerm2
- `WS /ws` - WebSocket для live updates

### Приклад API запиту

```bash
# Отримати список сесій
curl http://localhost:8888/api/sessions

# Отримати вміст панелі (URL-encoded pane ID)
curl "http://localhost:8888/api/pane/%251/content?lines=30"

# Перейменувати сесію
curl -X PUT http://localhost:8888/api/session/core/rename \
  -H "Content-Type: application/json" \
  -d '{"new_name": "backend"}'

# Завершити сесію
curl -X DELETE http://localhost:8888/api/session/test
```

## Структура проєкту

```
tmux-viewer/
├── main.go              # HTTP сервер + роутинг
├── watcher.go           # WebSocket hub + live updates
├── tmux/
│   ├── session.go       # Робота з tmux sessions
│   └── pane.go          # Capture pane content
├── web/
│   ├── index.html       # Frontend HTML
│   ├── style.css        # Terminal-style стилі
│   └── app.js           # API клієнт + WebSocket
├── build.sh             # Build script
└── README.md            # Документація
```

## Як це працює

1. **Backend** виконує tmux команди для отримання списку сесій, вікон та панелей
2. **WebSocket** періодично (кожні 2 сек) відправляє оновлення клієнтам
3. **Frontend** відображає сесії в grid layout і оновлює вміст панелей
4. **Кешування** мінімізує непотрібні запити до tmux

## Конфігурація

За замовчуванням:
- Порт: `8888`
- Оновлення: кожні `2 секунди`
- Preview: `40-50 рядків` на панель

Можна змінити в `main.go` та `watcher.go`.

## Автозапуск (опціонально)

Для автозапуску при старті системи можна створити launchd service:

```bash
# ~/Library/LaunchAgents/com.tmux-viewer.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tmux-viewer</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/YOUR_USERNAME/Projects/tmux-viewer/tmux-viewer</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Завантажити service:

```bash
launchctl load ~/Library/LaunchAgents/com.tmux-viewer.plist
```

## Troubleshooting

### Сервер не запускається

Перевірте чи порт 8888 не зайнятий:
```bash
lsof -i :8888
```

### Не відображаються сесії

Перевірте чи tmux запущений:
```bash
tmux ls
```

### WebSocket не підключається

Перевірте консоль браузера (F12) для помилок.

## Ліцензія

MIT

## Автор

Створено для локального використання.
