import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { jsPDF } from "jspdf";

// ---------- CONFIGURE AQUI ----------
// Use os dados corretos do seu projeto Firebase.
// OBS: o storageBucket normalmente segue o padrão: <PROJECT_ID>.appspot.com
const firebaseConfig = {
  apiKey: "AIzaSyASyc2221Ch4ddMews827y-SY856iXjkvQ",
  authDomain: "padaria-novo-pao.firebaseapp.com",
  projectId: "padaria-novo-pao",
  storageBucket: "padaria-novo-pao.appspot.com",
  messagingSenderId: "546740088762",
  appId: "1:546740088762:web:c829d0cbf8ae1c35d53783",
  measurementId: "G-QKYH4LCRS8",
};
// ------------------------------------

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (err) {
  // Se ocorrer algum erro ao inicializar o Firebase, vamos logar e seguir sem Firestore.
  // Isso evita que a aplicação quebre com o erro "Service firestore is not available".
  // Em produção você deve corrigir a configuração do Firebase.
  // eslint-disable-next-line no-console
  console.error("Erro inicializando Firebase/Firestore:", err);
}

export default function App() {
  const [quantidade, setQuantidade] = useState(0);
  const [precoUnitario, setPrecoUnitario] = useState(0.3);
  const [cliente, setCliente] = useState("");
  const [historico, setHistorico] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [firestoreOk, setFirestoreOk] = useState(Boolean(db));

  useEffect(() => {
    if (!db) return;

    try {
      const q = query(collection(db, "notas"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, (snapshot) => {
        const dados = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setHistorico(dados);
      });
      return () => unsub();
    } catch (err) {
      console.error("Erro ao conectar snapshot do Firestore:", err);
      setFirestoreOk(false);
    }
  }, []);

  function calcularTotal(qtd, preco) {
    const q = Number(qtd) || 0;
    const p = Number(preco) || 0;
    const totalCentavos = Math.round(q * p * 100);
    return totalCentavos / 100;
  }

  async function gerarENotar() {
    if (!quantidade || Number(quantidade) <= 0) {
      alert("Informe uma quantidade válida");
      return;
    }

    const total = calcularTotal(quantidade, precoUnitario);

    // 1) Gerar PDF com jsPDF
    const docPdf = new jsPDF();
    docPdf.setFontSize(16);
    docPdf.text("PADARIA NOVO PÃO", 14, 20);
    docPdf.setFontSize(12);
    docPdf.text(`Cliente: ${cliente || "-"}`, 14, 36);
    docPdf.text(`Quantidade de pães: ${quantidade}`, 14, 44);
    docPdf.text(`Preço unitário: R$ ${Number(precoUnitario).toFixed(2)}`, 14, 52);
    docPdf.text(`Total: R$ ${total.toFixed(2)}`, 14, 60);
    docPdf.text(`Data: ${new Date().toLocaleString()}`, 14, 76);
    docPdf.save(`nota_padaria_${Date.now()}.pdf`);

    // 2) Salvar histórico no Firestore (se disponível)
    if (!db) {
      alert("PDF gerado, porém o Firestore não está disponível. Corrija a configuração do Firebase para salvar o histórico.");
      return;
    }

    try {
      await addDoc(collection(db, "notas"), {
        cliente: cliente || "--",
        quantidade: Number(quantidade),
        precoUnitario: Number(precoUnitario),
        total: total,
        createdAt: serverTimestamp(),
      });

      setQuantidade(0);
      setCliente("");
      alert("Nota gerada e salva no histórico com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar a nota no Firebase: verifique a configuração e as regras do Firestore.");
    }
  }

  function somarMes(yyyy_mm) {
    const [ano, mes] = yyyy_mm.split("-").map(Number);
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);

    const soma = historico
      .filter((h) => {
        // createdAt pode ser um Timestamp do Firestore ou string/Date em casos de fallback
        let created;
        if (h.createdAt && typeof h.createdAt.toDate === "function") {
          created = h.createdAt.toDate();
        } else if (h.createdAt instanceof Timestamp) {
          created = h.createdAt.toDate();
        } else if (typeof h.createdAt === "string") {
          created = new Date(h.createdAt);
        } else {
          created = new Date();
        }
        return created >= inicio && created < fim;
      })
      .reduce((acc, cur) => acc + (Number(cur.total) || 0), 0);

    return soma.toFixed(2);
  }

  async function removerNota(id) {
    if (!confirm("Deseja mesmo excluir esta nota do histórico?")) return;
    if (!db) {
      alert("Firestore não disponível: não é possível excluir.");
      return;
    }
    try {
      await deleteDoc(doc(db, "notas", id));
    } catch (err) {
      console.error(err);
      alert("Erro ao deletar nota");
    }
  }

  const totalDoMes = somarMes(mesSelecionado);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold">PADARIA NOVO PÃO — Gerador de Notas</h1>
          <p className="text-sm text-gray-600 mt-1">Crie notas em PDF e registre o histórico no Firebase (Firestore).</p>
          {!firestoreOk && (
            <div className="mt-3 p-3 text-sm bg-yellow-100 text-yellow-900 rounded">
              Atenção: Firestore não está disponível. Verifique a configuração de <code>firebaseConfig</code> no arquivo.
            </div>
          )}
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-4">Criar nova nota</h2>

            <label className="block text-sm font-medium">Nome do cliente</label>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} className="w-full p-2 border rounded mb-3" placeholder="Ex: João da Silva" />

            <label className="block text-sm font-medium">Quantidade de pães</label>
            <input
              type="number"
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="w-full p-2 border rounded mb-3"
            />

            <label className="block text-sm font-medium">Preço por pão (R$)</label>
            <input
              type="number"
              step="0.01"
              value={precoUnitario}
              onChange={(e) => setPrecoUnitario(Number(e.target.value))}
              className="w-full p-2 border rounded mb-4"
            />

            <div className="flex gap-2">
              <button onClick={gerarENotar} className="flex-1 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700">Gerar nota (PDF) e salvar</button>
              <button
                onClick={() => {
                  const t = calcularTotal(quantidade, precoUnitario);
                  alert(`Total: R$ ${t.toFixed(2)}`);
                }}
                className="py-2 px-4 rounded-xl border">
                Calcular
              </button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow">
            <h2 className="text-xl font-semibold mb-4">Histórico e soma mensal</h2>

            <label className="block text-sm font-medium">Selecione mês (YYYY-MM)</label>
            <input type="month" value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="w-full p-2 border rounded mb-4" />

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">Total do mês selecionado:</div>
              <div className="text-2xl font-bold">R$ {totalDoMes}</div>
            </div>

            <div className="max-h-72 overflow-auto">
              {historico.length === 0 && <div className="text-sm text-gray-500">Nenhuma nota ainda.</div>}

              {historico.map((h) => {
                const created = h.createdAt && typeof h.createdAt.toDate === "function" ? h.createdAt.toDate() : new Date();
                return (
                  <div key={h.id} className="mb-3 p-3 border rounded">
                    <div className="flex justify-between text-sm">
                      <div>
                        <div className="font-semibold">{h.cliente}</div>
                        <div className="text-xs text-gray-600">{created.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">R$ {(Number(h.total) || 0).toFixed(2)}</div>
                        <div className="text-xs text-gray-600">Qtd: {h.quantidade}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          // gerar PDF a partir do histórico
                          const docPdf = new jsPDF();
                          docPdf.setFontSize(16);
                          docPdf.text("PADARIA NOVO PÃO", 14, 20);
                          docPdf.setFontSize(12);
                          docPdf.text(`Cliente: ${h.cliente}`, 14, 36);
                          docPdf.text(`Quantidade de pães: ${h.quantidade}`, 14, 44);
                          docPdf.text(`Preço unitário: R$ ${Number(h.precoUnitario).toFixed(2)}`, 14, 52);
                          docPdf.text(`Total: R$ ${Number(h.total).toFixed(2)}`, 14, 60);
                          docPdf.text(`Data: ${created.toLocaleString()}`, 14, 76);
                          docPdf.save(`nota_padaria_${h.id}.pdf`);
                        }}
                        className="px-3 py-1 rounded border text-sm">
                        Baixar PDF
                      </button>

                      <button onClick={() => removerNota(h.id)} className="px-3 py-1 rounded border text-sm">Excluir</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="text-center text-sm text-gray-500 mt-6">PADARIA NOVO PÃO — Sistema simples de geração de notas</footer>
      </div>
    </div>
  );
}
