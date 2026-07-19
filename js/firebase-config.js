/* ============================================================
   UIANA LOSER PRO MAX — firebase-config.js

   >>> SUBSTITUA os valores abaixo pelas chaves do SEU projeto <<<

   Como conseguir (grátis, 5 minutos):
   1. Acesse https://console.firebase.google.com/
   2. Clique em "Adicionar projeto", dê um nome (ex: uiana-loser)
      e siga o assistente (pode desativar o Google Analytics).
   3. No menu lateral, vá em "Compilação" > "Realtime Database"
      e clique em "Criar banco de dados".
        - Escolha a localização mais próxima de você.
        - Em "Regras de segurança", comece no modo de TESTE
          (permite leitura/escrita por até 30 dias — ótimo pra
          jogar com os amigos agora; depois dá pra travar as
          regras se quiser deixar mais seguro).
   4. No menu lateral, clique no ícone de engrenagem >
      "Configurações do projeto" > role até "Seus aplicativos" >
      clique no ícone "</>" (Web) > registre o app.
   5. O Firebase vai te mostrar um objeto firebaseConfig como o
      exemplo abaixo. Copie os valores para cá.
   6. Em "Compilação" > "Authentication" > "Sign-in method",
      ative o provedor "Anônimo". (é assim que cada jogador
      recebe uma identidade sem precisar criar conta/senha)

   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyB9CRoqR_rdrcBNkt1uHl8QOLbeUgHzcfQ",
  authDomain: "uiana-loser.firebaseapp.com",
  databaseURL: "https://uiana-loser-default-rtdb.firebaseio.com",
  projectId: "uiana-loser",
  storageBucket: "uiana-loser.firebasestorage.app",
  messagingSenderId: "540661883141",
  appId: "1:540661883141:web:8e531c92ce7006b8e1976c"
};

// Não edite abaixo desta linha.
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
