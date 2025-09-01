FROM node:lts-alpine
LABEL authors="OpenHealth"

# Required for PDF -> image conversion used by pdf2pic
# GraphicsMagick handles image ops; Ghostscript renders PDF pages.
RUN apk add -U --no-cache \
    graphicsmagick \
    ghostscript

WORKDIR /app

COPY package.json prisma/ .

RUN npm install

COPY . .

RUN npm run build && \
    adduser --disabled-password ohuser && \
    chown -R ohuser .

USER ohuser
EXPOSE 3000
ENTRYPOINT ["sh", "-c", "npx prisma db push --accept-data-loss && npx prisma db seed && npm start"]
