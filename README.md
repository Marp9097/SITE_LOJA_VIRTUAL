# 🛍️ Loja — GitHub Pages + servidor no tablet (Termux)

Loja virtual com visual dark e moderno, painel admin completo, cupons, categorias, fotos guardadas no banco, Pix (com confirmação automática pelo Mercado Pago) e aviso de cada pedido no seu e-mail, com a notinha.

```
docs/      → site (vai pro GitHub Pages): loja, página da nota e painel admin
server/    → servidor (roda no tablet com Termux). Node puro, sem npm install
```

O frontend fica no GitHub Pages e conversa com o servidor do tablet por um **túnel HTTPS da Cloudflare** (grátis). Assim o tablet não precisa de IP fixo nem abrir porta no roteador.

---

## 1) Subir para o GitHub

1. Crie um repositório (ex.: `minha-loja`) e envie **todo** o conteúdo desta pasta.
2. No repositório: **Settings → Pages → Source: Deploy from a branch → Branch `main` / pasta `/docs` → Save**.
3. Em ~1 minuto a loja estará em `https://SEU-USUARIO.github.io/minha-loja/`
   e o painel em `https://SEU-USUARIO.github.io/minha-loja/admin.html`.

## 2) Preparar o tablet (Termux)

Instale o **Termux pelo F-Droid** (a versão da Play Store é antiga). Depois:

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs git cloudflared termux-api
git clone https://github.com/SEU-USUARIO/minha-loja.git
cd minha-loja/server
cp .env.example .env
nano .env        # preencha GITHUB_TOKEN e GITHUB_REPO (veja abaixo)
bash iniciar.sh
```

O `iniciar.sh`:
- liga o servidor e reinicia sozinho se ele cair;
- abre o túnel HTTPS da Cloudflare e mostra o endereço público;
- atualiza `docs/js/config.js` no GitHub com esse endereço, para a loja do Pages sempre achar o servidor.

**Token do GitHub** (para a atualização automática): github.com → Settings → Developer settings → *Fine-grained tokens* → Generate → *Only select repositories* (o da loja) → Permissions → **Contents: Read and write**. Cole no `.env` como `GITHUB_TOKEN=...` e `GITHUB_REPO=seu-usuario/minha-loja`.

> Sem token também funciona: abra a loja uma vez com `?api=https://ENDERECO.trycloudflare.com` no final do link — o navegador memoriza. Ou acesse direto pelo endereço do túnel (o servidor também serve a loja).

### Deixar 24h ligado
- Android: **Configurações → Apps → Termux → Bateria → Sem restrições**.
- O script já chama `termux-wake-lock` (mantém o Termux acordado).
- Para iniciar sozinho ao ligar o tablet: instale o app **Termux:Boot** (F-Droid), abra-o uma vez e crie:
  ```bash
  mkdir -p ~/.termux/boot
  echo 'bash ~/minha-loja/server/iniciar.sh > ~/loja.log 2>&1' > ~/.termux/boot/loja.sh
  chmod +x ~/.termux/boot/loja.sh
  ```

### Endereço fixo (opcional)
O túnel grátis muda de endereço quando reinicia (por isso o script atualiza o GitHub). Se tiver um domínio na Cloudflare, crie um túnel em **Zero Trust → Networks → Tunnels**, aponte para `http://localhost:3000` e cole o token em `CF_TUNNEL_TOKEN` no `.env`. Depois coloque `API_URL` com seu domínio em `docs/js/config.js`.

## 3) Primeiro acesso ao painel

Senha inicial: **`admin123`** (ou a definida em `ADMIN_PASSWORD` no `.env` antes da primeira execução). Troque em **Conta**.

| Aba | O que faz |
|---|---|
| Painel | Resumo, vendas dos últimos 7 dias, alertas de configuração |
| Pedidos | Lista/filtra, muda status (pago, enviado…), cria pedido manual **com cupom**, itens avulsos, desconto extra, frete, envia link da nota por WhatsApp |
| Produtos | Várias fotos por produto (a 1ª é a capa), preço promocional, estoque, destaque, ocultar |
| Categorias | Com foto (aparecem em cards na página inicial) e filtros em abas |
| Cupons | % ou valor fixo, pedido mínimo, limite de usos, validade |
| Aparência | Nome, logo, ícone, banner, **cores** (com temas prontos), **imagem de fundo** com escurecimento, fonte, arredondamento, WhatsApp/Instagram, taxa de entrega |
| Pagamento | Mercado Pago (automático) ou Pix direto na sua chave (confirmação manual) |
| Notificações | E-mail que recebe os pedidos + SMTP + botão de teste |

## 4) Pagamento Pix

**Mercado Pago (recomendado — confirma sozinho):** crie uma aplicação em mercadopago.com.br/developers → *Credenciais de produção* → copie o **Access Token** (`APP_USR-...`) para a aba Pagamento. Cada pedido gera um QR Code; quando o cliente paga, o pedido vira **Pago**, a tela do cliente atualiza e você recebe o e-mail. O servidor recebe o aviso do Mercado Pago na hora (webhook) e, além disso, confere os pendentes a cada 15 s.

**Pix direto na sua chave:** sem taxa, mas os bancos não avisam sistemas externos sem integração paga, então você marca o pedido como pago no painel. O QR já sai com o valor e o código do pedido.

## 5) E-mail com a notinha (Gmail)

1. Ative a verificação em 2 etapas na conta Google.
2. Acesse **myaccount.google.com/apppasswords**, crie uma senha de app "Loja".
3. Na aba Notificações: servidor `smtp.gmail.com`, porta `465`, usuário = seu Gmail, senha = a senha de app. Clique em **Enviar e-mail de teste**.

Você recebe um e-mail para cada novo pedido e outro quando o pagamento é confirmado. Opcionalmente o cliente também recebe.

## Backup

Tudo (produtos, pedidos, cupons, configurações e **imagens**) fica em um único arquivo: `server/data/loja.db`. Copie-o de vez em quando:
```bash
termux-setup-storage
cp ~/minha-loja/server/data/loja.db ~/storage/downloads/loja-backup-$(date +%F).db
```

## Problemas comuns
- **"Loja temporariamente fora do ar"**: o servidor ou o túnel caiu, ou o `config.js` ainda aponta para o endereço antigo (aguarde ~1 min após reiniciar).
- **cloudflared com erro de DNS no Termux**: rode `pkg upgrade cloudflared` e tente de novo.
- **Node antigo**: o servidor precisa do Node 22.5+ (`node -v`). Atualize com `pkg upgrade nodejs`.
