#!/usr/bin/env bash
set -e

PROJECT_NAME="${1:-hr-management}"

echo "=== Setup Next.js 15 + TypeScript Strict + Prisma + SQLite ==="

# 1. Create Next.js 15 app
echo "[1/7] Creating Next.js 15 app..."
npx create-next-app@15.0.3 "$PROJECT_NAME" \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --turbopack \
  --no-git \
  --import-alias "@/*" \
  --yes

cd "$PROJECT_NAME"

# 2. Pin exact versions
echo "[2/7] Installing exact dependencies..."
npm install react@19.0.0 react-dom@19.0.0 --save-exact
npm install next@15.0.3 --save-exact

# 3. Prisma + SQLite
echo "[3/7] Installing Prisma + SQLite..."
npm install @prisma/client@5.22.0 --save-exact
npm install -D prisma@5.22.0 --save-exact

# 4. Auth + validation utilities
echo "[4/7] Installing JWT + validation..."
npm install jose@5.9.6 bcryptjs@2.4.3 zod@3.23.8 --save-exact
npm install -D @types/bcryptjs@2.4.6 --save-exact

# 5. shadcn/ui core dependencies
echo "[5/7] Installing shadcn/ui dependencies..."
npm install class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@2.6.0 lucide-react@0.460.0 @radix-ui/react-slot@1.1.0 --save-exact
npm install -D tailwindcss-animate@1.0.7 --save-exact

# 6. Dev dependencies exact versions
echo "[6/7] Pinning dev dependencies..."
npm install -D typescript@5.6.3 @types/node@20.17.6 @types/react@19.0.0 @types/react-dom@19.0.0 --save-exact
npm install -D postcss@8.4.49 autoprefixer@10.4.20 --save-exact
npm install -D eslint@8.57.1 eslint-config-next@15.0.3 --save-exact
npm install -D tsx@4.19.2 --save-exact

# 7. Folder structure
echo "[7/7] Creating folder structure..."
mkdir -p src/app/api/auth
mkdir -p src/app/api/employees
mkdir -p src/app/api/organization/companies
mkdir -p src/app/dashboard
mkdir -p src/app/login
mkdir -p src/components/ui
mkdir -p src/lib
mkdir -p src/hooks
mkdir -p src/types
mkdir -p prisma
mkdir -p data
mkdir -p public/uploads

echo ""
echo "=== DONE ==="
echo "Next steps:"
echo "  1. cd $PROJECT_NAME"
echo "  2. cp .env.example .env"
echo "  3. Edit .env — set JWT_SECRET and TRUSTED_ORIGINS"
echo "  4. Copy prisma/schema.prisma, tailwind.config.ts, tsconfig.json, next.config.ts, postcss.config.mjs, src/app/globals.css, src/lib/utils.ts"
echo "  5. npx prisma db push"
echo "  6. npm run dev"
