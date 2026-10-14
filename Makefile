.PHONY: help install config build run start dev-frontend test smoke compile cli clean

VENV ?= .venv
PYTHON ?= $(shell if [ -f $(VENV)/bin/python ]; then echo $(VENV)/bin/python; elif command -v python3 >/dev/null 2>&1; then echo python3; else echo python; fi)
UVICORN ?= $(shell if [ -f $(VENV)/bin/uvicorn ]; then echo $(VENV)/bin/uvicorn; elif command -v uvicorn >/dev/null 2>&1; then echo uvicorn; fi)
PYTEST ?= $(shell if [ -f $(VENV)/bin/pytest ]; then echo $(VENV)/bin/pytest; elif command -v pytest >/dev/null 2>&1; then echo pytest; fi)
HOST ?= 127.0.0.1
PORT ?= 8000

help:
	@echo "Smallville 快捷管理命令:"
	@echo "  make run          - 启动后端服务及挂载的 Web 前端 (http://$(HOST):$(PORT))"
	@echo "  make build        - 构建前端生产包 (frontend/dist)"
	@echo "  make dev-frontend - 启动前端 Vite 独立热重载开发服务器"
	@echo "  make config       - 读取 .env 并重新生成 Reverie utils.py"
	@echo "  make cli          - 启动原版交互式 Reverie 终端模拟器"
	@echo "  make test         - 运行后端单元测试和冒烟测试"
	@echo "  make smoke        - 仅运行 Reverie 引擎冒烟测试"
	@echo "  make compile      - 编译检查所有 Python 代码"
	@echo "  make install      - 安装 Python 和 Node 依赖"
	@echo "  make clean        - 清理 Python 字节码缓存和测试缓存"

config:
	$(PYTHON) scripts/generate_utils.py

build:
	cd frontend && npm run build

run: config
	$(UVICORN) backend.app.main:app --reload --host $(HOST) --port $(PORT)

start: run

dev-frontend:
	cd frontend && npm run dev

test: config
	$(PYTEST) backend/tests
	$(PYTHON) scripts/smoke_reverie.py

smoke: config
	$(PYTHON) scripts/smoke_reverie.py

compile:
	$(PYTHON) -m compileall backend/app scripts reverie/backend_server

cli: config
	cd reverie/backend_server && $(PYTHON) reverie.py

install:
	$(PYTHON) -m pip install -r requirements.txt
	cd frontend && npm install

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache
