<div align="center">

# 💬 Cell Messenger

### Высокопроизводительный мессенджер реального времени с групповыми аудио- и видеозвонками на базе WebRTC SFU

[![Go Version](https://img.shields.io/badge/Go-1.25-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://golang.org)
[![WebRTC Pion](https://img.shields.io/badge/WebRTC-Pion_v3-339933?style=for-the-badge&logo=webrtc&logoColor=white)](https://pion.ly)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![MinIO](https://img.shields.io/badge/MinIO-S3_Storage-C72C48?style=for-the-badge&logo=minio&logoColor=white)](https://min.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br/>

**Cell** — это современная open-source платформа для мгновенного обмена сообщениями и медиафайлами, а также проведения голосовых и видеоконференций с низкой задержкой. 
Архитектура построена на микросервисной модели: Go-бэкенд для бизнес-логики и WebSockets, специализированный SFU-сервер на Pion WebRTC для маршрутизации медиапотоков, быстрый React 19 интерфейс и полнофункциональная инфраструктура в Docker.

[Особенности](#-ключевые-особенности) • [Архитектура](#-архитектура-системы) • [Стек технологий](#-стек-технологий) • [Быстрый старт](#-быстрый-старт-docker-compose) • [Локальная разработка](#-локальная-разработка) • [API и протокол](#-api-и-протокол-реального-времени) • [Roadmap](#-roadmap)

---

</div>

## ✨ Ключевые особенности

### 💬 Обмен сообщениями и чаты
- **Real-Time WebSocket Hub:** двусторонний обмен сообщениями с мгновенной доставкой через постоянные соединения.
- **Личные диалоги (1-on-1):** гарантированная уникальность пар собеседников на уровне ограничений БД.
- **Групповые чаты:** создание комнат с ролевой моделью (`owner`, `admin`, `member`), кастомными аватарами и метаданными.
- **Статусы сообщений:** отметки о прочтении, статус доставки (`ack`), подсчет непрочитанных сообщений.
- **Индикаторы активности:** отображение «печатает...» в реальном времени с автоматическим сбросом по таймауту.
- **Курсорная пагинация:** эффективная подгрузка истории сообщений без просадок по производительности на больших объемах данных.

### 📹 Аудио- и видеозвонки (WebRTC SFU)
- **Selective Forwarding Unit (SFU):** собственный легковесный медиасервер на базе Go и Pion WebRTC без транскодирования, обеспечивающий минимальную задержку и низкую нагрузку на CPU.
- **Многопользовательские конференции:** маршрутизация аудио- и видеопотоков каждому участнику в реальном времени.
- **Динамическая ренегоциация:** бесшовное подключение и отключение участников во время активного звонка.
- **Контроль медиапотоков:** мгновенное включение/отключение микрофона и камеры, плавающее окно звонка (picture-in-picture / minimize).
- **Восстановление видео (RTCP PLI):** генерация пакетов *Picture Loss Indication* для запроса ключевых кадров (Keyframe/I-Frame) при подключении новых зрителей.
- **Автономный отладочный веб-клиент:** встроенный интерфейс тестирования WebRTC на `/calls/`.

### 🎙️ Медиа и файловое хранилище (S3 / MinIO)
- **Голосовые сообщения:** запись звука в браузере с живым таймером, предпрослушиванием и отправкой в S3.
- **Фото и видео:** загрузка вложений до 50 МБ с превью, спиннером загрузки и просмотром в Lightbox-галерее.
- **Умный парсер тегов:** хранение медиа-вложений и системных событий звонков в виде структурированных тегов (`{{media:...}}`, `{{call:...}}`) с обратной совместимостью для текста.
- **Аватары:** поддержка загрузки и кэширования аватаров пользователей и групп в MinIO.

### 🎨 Интерфейс и UX
- **React 19 + TypeScript + Vite:** ультрабыстрый рендеринг и строгая типизация.
- **Современный UI / Dark & Light Theme:** стильная темная и светлая темы с плавной анимацией и Glassmorphism-эффектами.
- **PWA (Progressive Web App):** поддержка установки приложения на десктоп и мобильные устройства, работа с сервис-воркерами.
- **Аудио-уведомления:** ненавязчивые звуковые эффекты для входящих сообщений.
- **Быстрый нечеткий поиск:** мгновенный поиск собеседников по имени и email с использованием PostgreSQL триграммных индексов (`pg_trgm`).

---

## 🏛 Архитектура системы

Проект разделен на слабосвязанные сервисы, объединенные через единый шлюз Nginx:

```mermaid
flowchart TD
    Client["Client (Browser / PWA)"] -->|HTTP / WS| Nginx["Nginx Reverse Proxy (:80)"]

    subgraph Infrastructure ["Cell Infrastructure"]
        Nginx -->|/ (SPA Static)| Frontend["Frontend (React 19 / Vite)"]
        Nginx -->|/api/* & /api/v1/ws/| Backend["Backend API (Go / Gin :8080)"]
        Nginx -->|/api/v1/calls/* & /calls/| CallsSFU["Calls Service SFU (Go / Pion :8000)"]
        Nginx -->|/cell-media/*| MinIO["MinIO S3 Storage (:9000/:9001)"]

        Backend -->|pgxpool| Postgres[("PostgreSQL 16 (:5432)")]
        CallsSFU -->|pgxpool (Auth/Rooms)| Postgres
        Backend -->|AWS SDK v2| MinIO
    end

    CallsSFU <==>|WebRTC UDP: 50000-50050| Client
```

### Назначение компонентов

| Сервис | Порт | Технологии | Роль в системе |
|---|---|---|---|
| **Nginx** | `80` | Nginx Alpine | Единая точка входа, SSL-терминация, проксирование HTTP/WS, раздача статики SPA |
| **Backend API** | `8080` (внутр.) | Go, Gin, gorilla/websocket, pgx | REST API, JWT-авторизация, управление чатами, чат-сокетами и загрузкой в S3 |
| **Calls Service** | `8000` (внутр.) + `50000-50050/udp` | Go, Pion WebRTC, gorilla/websocket | WebRTC SFU медиасервер, сигналинг звонков, синхронизация треков |
| **Frontend** | — (билд в Nginx) | React 19, Vite, Tailwind CSS, Lucide | Пользовательский интерфейс, аудиорекордер, WebRTC клиент, PWA |
| **PostgreSQL** | `5432` | Postgres 16 Alpine, `pg_trgm`, `pgcrypto` | Реляционное хранилище пользователей, чатов, прав и сообщений |
| **MinIO** | `9000` (API), `9001` (Web) | MinIO S3 Server | Хранилище медиафайлов, аватарок и голосовых сообщений |

---

## 🛠 Стек технологий

- **Backend & Core Services:**
  - **Go 1.25** — высокая производительность и низкое потребление ресурсов.
  - **Gin Web Framework** — HTTP-роутер с кастомными middleware (CORS, логгирование с замером латентности, JWT).
  - **Pion WebRTC v3** — чистая Go-реализация WebRTC для построения SFU.
  - **gorilla/websocket** — надежная реализация протокола WebSocket.
  - **pgx/v5** — высокопроизводительный драйвер PostgreSQL с пулом соединений (`puddle`).
  - **AWS SDK for Go v2** — интеграция с S3-совместимым хранилищем MinIO.
  - **golang-jwt/v5** — генерация и валидация JWT-токенов доступа.

- **Frontend & Client:**
  - **React 19** & **TypeScript 5.7**
  - **Vite 6** & **vite-plugin-pwa**
  - **Tailwind CSS 3.4**
  - **Lucide React** (иконки)

- **База данных и инфраструктура:**
  - **PostgreSQL 16** (триграммные GIN-индексы для поиска `pg_trgm`, генерация UUID через `pgcrypto`, составные B-Tree индексы для пагинации сообщений).
  - **MinIO Object Storage** (S3 совместимый).
  - **Docker & Docker Compose** (мультистейдж сборка Alpine-образов).
  - **Nginx Reverse Proxy**.

---

## 📁 Структура проекта

```
Cell/
├── backend/                  # Основной бэкенд (Go API + Chat WebSocket)
│   ├── cmd/api/main.go       # Точка входа API-сервера
│   ├── internal/
│   │   ├── config/           # Парсинг переменных окружения
│   │   ├── database/         # Инициализация пула соединений pgx
│   │   ├── jwt/              # Middleware и утилиты работы с JWT
│   │   ├── models/           # DTO и внутренние модели данных
│   │   ├── storage/          # Клиент к S3/MinIO
│   │   └── transport/
│   │       ├── http/         # REST-контроллеры (Auth, Chats, Files, Users)
│   │       └── ws/           # WebSocket Hub, диспетчер событий и клиенты
│   ├── Dockerfile            # Мультистейдж сборка Go-бэкенда
│   └── go.mod
│
├── CallsService/             # WebRTC SFU сервис аудио- и видеозвонков
│   ├── auth.go               # Валидация JWT в контексте звонков
│   ├── config.go             # Конфигурация портов, STUN/TURN и NAT
│   ├── db.go                 # Проверка прав доступа пользователей к чатам
│   ├── handlers.go           # REST API комнат и WebSocket-сигналинг
│   ├── room.go               # Менеджер активных комнат звонков
│   ├── sfu.go                # Реализация WebRTC SFU (Pion) и роутинг RTP-треков
│   ├── index.html            # Standalone страница для тестирования WebRTC
│   ├── Dockerfile            # Мультистейдж сборка Calls-сервера
│   └── go.mod
│
├── frontend/                 # Клиентское приложение (React 19 + Vite)
│   ├── src/
│   │   ├── api/              # Клиент для REST API (Auth, Chats, Calls, Files)
│   │   ├── components/
│   │   │   ├── auth/         # Авторизация и регистрация
│   │   │   ├── chat/         # Окно сообщений, инпут, пузыри и CallModal (WebRTC)
│   │   │   ├── common/       # Аватары, кнопки, модальные окна, тосты
│   │   │   ├── media/        # Lightbox, диктофон голосовых, пикер файлов
│   │   │   ├── modals/       # Создание диалогов, групп, профиль и настройки
│   │   │   ├── pwa/          # Баннер установки PWA
│   │   │   └── sidebar/      # Список чатов, поиск, шапка
│   │   ├── context/          # React Context (Auth, Chat, UI, Theme)
│   │   ├── styles/           # Tailwind и кастомные CSS-модули
│   │   ├── utils/            # Парсер медиатегов, звуки, форматирование дат
│   │   └── ws/               # Клиентский сервис работы с WebSocket
│   ├── Dockerfile            # Nginx-контейнер со статикой Vite
│   └── package.json
│
├── nginx/
│   └── default.conf          # Конфигурация обратного прокси и маршрутизации
│
├── docker-compose.yaml       # Полный стек оркестрации всех компонентов
├── init.sql                  # DDL инициализации PostgreSQL (схемы и индексы)
├── openapi.json              # Спецификация OpenAPI 3.0 (Swagger)
└── .env                      # Базовые параметры конфигурации
```

---

## 🚀 Быстрый старт (Docker Compose)

Самый простой и рекомендуемый способ поднять весь проект «из коробки» со всеми зависимостями:

### Предварительные требования
- Установленный [Docker](https://docs.docker.com/get-docker/) (20.10+)
- Установленный [Docker Compose v2](https://docs.docker.com/compose/)

### 1. Клонирование репозитория
```bash
git clone https://github.com/artaka/Cell.git
cd Cell
```

### 2. Запуск контейнеров
```bash
docker compose up --build -d
```

> **Примечание:** В `.env` по умолчанию включен параметр `COMPOSE_PARALLEL_LIMIT=1` для стабильной последовательной сборки на системах с ограниченными ресурсами.

### 3. Доступные сервисы

После успешного запуска откройте в браузере:

| Сервис | URL | Описание |
|---|---|---|
| 🌐 **Веб-клиент Cell** | [http://localhost](http://localhost) | Основное приложение мессенджера |
| 📞 **Calls Test Client** | [http://localhost/calls/](http://localhost/calls/) | Автономная тестовая панель WebRTC SFU |
| 🗄️ **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Управление S3 (логин: `minioadmin`, пароль: `miniopassword123`) |
| 🔌 **API Health Check** | [http://localhost/api/v1/health](http://localhost/api/v1/health) | Проверка работоспособности бэкенда |
| 📡 **Calls Health Check** | [http://localhost/api/v1/calls/health](http://localhost/api/v1/calls/health) | Проверка статуса сервиса звонков |

---

## 💻 Локальная разработка

Если вы хотите разрабатывать и модифицировать компоненты отдельно без пересборки Docker-контейнеров:

### 1. Запуск БД и MinIO
Запустите только инфраструктурные зависимости:
```bash
docker compose up postgres minio -d
```

### 2. Запуск Backend API
```bash
cd backend
go mod download

# Переменные окружения (Windows PowerShell)
$env:PORT="8080"
$env:DB_URL="postgres://celldb:mysuperstrongpassword@localhost:5432/cell_db?sslmode=disable"
$env:SECRET_KEY="super-secret-key123"
$env:S3_ENDPOINT="http://localhost:9000"
$env:S3_BUCKET="cell-media"
$env:S3_ACCESS_KEY="minioadmin"
$env:S3_SECRET_KEY="miniopassword123"
$env:S3_PUBLIC_URL="http://localhost:9000/cell-media"

# Запуск
go run ./cmd/api
```

### 3. Запуск Calls Service
```bash
cd CallsService
go mod download

# Переменные окружения (Windows PowerShell)
$env:PORT="8000"
$env:DB_URL="postgres://celldb:mysuperstrongpassword@localhost:5432/cell_db?sslmode=disable"
$env:SECRET_KEY="super-secret-key123"
$env:STUN_SERVER="stun:stun.l.google.com:19302"
$env:UDP_MIN_PORT="50000"
$env:UDP_MAX_PORT="50050"

# Запуск
go run .
```

### 4. Запуск Frontend
```bash
cd frontend
npm install
npm run dev
```
Фронтенд по умолчанию будет доступен на `http://localhost:5173`. При необходимости настройте прокси в `vite.config.ts` на порты `8080` и `8000`.

---

## ⚙️ Переменные окружения

Ниже приведен список переменных конфигурации, используемых в сервисах:

| Переменная | По умолчанию (Docker) | Назначение |
|---|---|---|
| `DB_URL` | `postgres://celldb:mysuperstrongpassword@postgres:5432/cell_db?sslmode=disable` | Строка подключения к PostgreSQL |
| `SECRET_KEY` | `super-secret-key123` | Секретный ключ для подписи и проверки JWT (HMAC-SHA256) |
| `PORT` (Backend) | `8080` | Порт HTTP/WebSocket сервера бэкенда |
| `PORT` (Calls) | `8000` | Порт HTTP/WebSocket сервера звонков |
| `S3_ENDPOINT` | `http://minio:9000` | Адрес сервера MinIO / S3 |
| `S3_BUCKET` | `cell-media` | Имя бакета для хранения медиа и аватаров |
| `S3_ACCESS_KEY` | `minioadmin` | Ключ доступа к S3 |
| `S3_SECRET_KEY` | `miniopassword123` | Секретный ключ к S3 |
| `S3_PUBLIC_URL` | `http://localhost:9000/cell-media` | Публичный URL для доступа к медиафайлам |
| `STUN_SERVER` | `stun:stun.l.google.com:19302` | STUN сервер для прохождения NAT в WebRTC |
| `NAT_1TO1_IP` | `""` (пусто) | Внешний IP-адрес сервера (для продакшн развертывания за NAT) |
| `UDP_MIN_PORT` | `50000` | Нижняя граница UDP-портов для WebRTC RTP/RTCP |
| `UDP_MAX_PORT` | `50050` | Верхняя граница UDP-портов для WebRTC RTP/RTCP |

---

## 📡 API и протокол реального времени

Полная спецификация REST API доступна в файле [`openapi.json`](file:///d:/prog/Go/Cell/openapi.json). Вы можете импортировать его в [Swagger Editor](https://editor.swagger.io/) или Postman.

### Основные REST-эндпоинты

- **Авторизация:**
  - `POST /api/v1/auth/register` — регистрация нового пользователя
  - `POST /api/v1/auth/login` — авторизация и получение JWT-токена
- **Пользователи:**
  - `GET /api/v1/users/:id` — получение профиля пользователя
  - `GET /api/v1/chats/users/search?q={query}` — нечеткий поиск пользователей
- **Чаты:**
  - `POST /api/v1/chats/direct` — создание/получение личного чата
  - `POST /api/v1/chats/group` — создание группового чата
  - `GET /api/v1/chats/list` — список чатов с последними сообщениями и счетчиком непрочитанных
  - `GET /api/v1/chats/:id/messages?cursor={id}&limit={n}` — курсорная пагинация истории сообщений
  - `GET /api/v1/chats/:id/members` — список участников чата с ролями
- **Файлы (S3):**
  - `POST /api/v1/files/avatar` — загрузка аватара профиля
  - `POST /api/v1/files/chats/:id/avatar` — загрузка аватара группового чата
  - `POST /api/v1/files/messages/` — загрузка медиафайлов (изображения, видео, аудио)
- **Звонки:**
  - `POST /api/v1/calls/rooms` — создание или получение активной комнаты звонка
  - `GET /api/v1/calls/rooms/:id` — информация о комнате звонка
  - `GET /api/v1/calls/active?chat_id={id}` — проверка наличия активного звонка в чате
  - `POST /api/v1/calls/rooms/:id/end` — завершение звонка

---

### Протокол чат-WebSocket (`/api/v1/ws/?token=<JWT>`)

Все сообщения представляют собой JSON-объекты со структурой:
```json
{
  "action": "ACTION_NAME",
  "payload": { ... }
}
```

| Направление | Action | Описание payload |
|---|---|---|
| **Клиент ➔ Сервер** | `message:send` | `{ "chat_id": "UUID", "content": "Текст сообщения" }` |
| **Клиент ➔ Сервер** | `typing` | `{ "chat_id": "UUID", "is_typing": true }` |
| **Клиент ➔ Сервер** | `read` | `{ "chat_id": "UUID", "message_id": 123 }` |
| **Сервер ➔ Клиент** | `message:ack` | Подтверждение сохранения сообщения автору (`temp_id`, `id`, `created_at`) |
| **Сервер ➔ Клиент** | `message:new` | Трансляция нового сообщения всем участникам чата |
| **Сервер ➔ Клиент** | `typing` | Уведомление о наборе текста участником |
| **Сервер ➔ Клиент** | `read` | Уведомление о прочтении сообщений до указанного ID |
| **Сервер ➔ Клиент** | `error` | Сообщение об ошибке обработки |

---

### Протокол WebRTC SFU сигналинга (`/api/v1/calls/ws?token=<JWT>`)

Для согласования медиапотоков клиент и SFU обмениваются следующими типами сообщений:

```mermaid
sequenceDiagram
    autonumber
    actor Peer as User A (Browser)
    participant SFU as Calls Service (Pion SFU)
    actor Remote as User B (Browser)

    Peer->>SFU: WS connect (JWT)
    Peer->>SFU: { "type": "join", "room_id": "UUID" }
    SFU->>Peer: { "type": "joined", "peer_id": "UUID", "peers": [...] }
    SFU->>Remote: { "type": "peer_joined", "peer_id": "UUID", ... }

    Peer->>SFU: { "type": "offer", "sdp": "v=0..." }
    SFU->>Peer: { "type": "answer", "sdp": "v=0..." }
    Peer->>SFU: { "type": "candidate", "candidate": {...} }
    SFU->>Peer: { "type": "candidate", "candidate": {...} }

    Note over SFU: Ретрансляция RTP аудио/видео между всеми активными Peer
    Remote->>SFU: { "type": "leave" }
    SFU->>Peer: { "type": "peer_left", "peer_id": "UUID" }
```

---

## 🗺 Roadmap

- [ ] **E2EE (End-to-End Encryption):** сквозное шифрование личных сообщений на базе Web Crypto API.
- [ ] **Демонстрация экрана:** поддержка Screen Sharing в видеозвонках через WebRTC Display Capture API.
- [ ] **Горизонтальное масштабирование:** поддержка кластеризации WebSocket Hub через Redis Pub/Sub или NATS.
- [ ] **Push-уведомления:** интеграция Web Push API и Firebase Cloud Messaging (FCM).
- [ ] **Реакции и треды:** реакции эмодзи на сообщения и ответы в цепочках.
- [ ] **TURN-сервер (coturn):** встроенный контейнер для гарантированного соединения через строгие симметричные NAT.

---

## 🤝 Вклад в проект (Contributing)

Мы приветствуем любые улучшения, исправления багов и новые идеи!

1. Сделайте Fork репозитория.
2. Создайте ветку для вашей функциональности:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Зафиксируйте ваши изменения:
   ```bash
   git commit -m "Add amazing new feature"
   ```
4. Отправьте ветку в удаленный репозиторий:
   ```bash
   git push origin feature/amazing-feature
   ```
5. Откройте **Pull Request** с подробным описанием проделанной работы.

---

## 📄 Лицензия

Проект распространяется под свободной лицензией **MIT**. Подробности в файле [LICENSE](LICENSE).

---

<div align="center">
  <sub>Разработано с ❤️ для портфолио и open-source сообщества. Если проект оказался полезен, поставьте ⭐ звезду репозиторию!</sub>
</div>
