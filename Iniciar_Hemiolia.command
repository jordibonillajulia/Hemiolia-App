#!/bin/bash

# Aquest script inicia el servidor de desenvolupament de Hemiolia i obre l'aplicació al navegador.
# Creat per Antigravity.

# Força que el directori de treball sigui el del propi script
cd "$(dirname "$0")"

clear
echo "================================================================="
echo "                  INICIANT L'APLICACIÓ HEMIOLIA                  "
echo "================================================================="
echo ""
echo "  [1/3] Carregant l'entorn de Node.js (NVM)..."

# Carrega nvm si està disponible
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
else
  # Ruta de fallback basat en la teva instal·lació actual
  export PATH="/Users/hemiolia/.nvm/versions/node/v20.20.2/bin:$PATH"
fi

# Comprova si node i npm estan preparats
if ! command -v node &> /dev/null; then
  echo ""
  echo "  ❌ ERROR: No s'ha pogut trobar Node.js ni npm a l'entorn."
  echo "  Si us plau, instal·la Node.js per poder executar l'aplicació."
  echo ""
  read -p "Prem Enter per tancar aquesta finestra..."
  exit 1
fi

echo "  ✔ Node.js versió: $(node -v)"
echo "  ✔ npm versió: $(npm -v)"
echo ""
echo "  [2/3] Preparant l'obertura del navegador a http://localhost:3000..."

# Obre el navegador a la URL de desenvolupament després de 3 segons (dóna temps a Next.js a compilar)
(sleep 3 && open http://localhost:3000) &

echo ""
echo "  [3/3] Iniciant el servidor de desenvolupament de Next.js..."
echo "  (Pots tancar aquesta finestra per aturar el servidor)"
echo "-----------------------------------------------------------------"
echo ""

npm run dev -- -H 0.0.0.0
