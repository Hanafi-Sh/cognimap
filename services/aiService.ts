
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedChapter, GeneratedSubChapter, GeneratedDetail } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-pro-preview';

// --- HELPER: Generate Concise Title ---
export const generateTopicTitle = async (userPrompt: string): Promise<string> => {
  const prompt = `
    Role: Editor Bahasa Indonesia.
    Task: Ekstrak topik utama dari teks berikut menjadi judul yang sangat singkat dan padat (maksimal 1-3 kata).
    Input: "${userPrompt}"
    Output: Hanya judulnya saja. Jangan pakai tanda kutip.
    Bahasa: Indonesia.
  `;
  
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
        responseMimeType: 'text/plain'
    }
  });

  return response.text ? response.text.trim() : "Topik Baru";
};

// --- SINGLE STAGE GENERATION ---

export const generateChapters = async (topic: string, userContext: string): Promise<GeneratedChapter[]> => {
  const prompt = `
    Role: Dekan Fakultas dan Penyusun Kurikulum Lengkap.
    Task: Rancanglah daftar Bab Utama yang SANGAT LENGKAP, MENDALAM, dan KOMPREHENSIF untuk topik "${topic}".
    Context: ${userContext || "Mahasiswa ingin menguasai bidang ini dari nol sampai tingkat ahli."}
    Constraint: 
    1. **KUANTITAS ADAPTIF**: Sesuaikan jumlah bab dengan skala topik.
       - Jika topik SANGAT LUAS (misal: "Kalkulus", "Sejarah Dunia", "Biologi"), buatlah sangat banyak (10-20 bab) agar mencakup semua era/komponen tanpa terlewat.
       - Jika topik SPESIFIK/SEMPIT (misal: "Cara Menyeduh Kopi", "Rumus Pythagoras"), buatlah secukupnya (3-7 bab) asalkan tuntas. Jangan memaksakan jumlah banyak jika materi memang sedikit.
    2. **Kualitas**: Struktur harus logis, berurutan dari fundamental ke advanced.
    3. **Deskripsi**: Berikan deskripsi singkat 1 kalimat untuk setiap bab.
    4. **Bahasa**: Gunakan Bahasa Indonesia yang baku, akademis, dan profesional.
    5. **No Numbering**: JANGAN sertakan nomor bab dalam field title (misal: "1. Pendahuluan"). Cukup judulnya saja (misal: "Pendahuluan"). Aplikasi akan memberi nomor otomatis.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Judul Bab (Tanpa Nomor)" },
                briefDescription: { type: Type.STRING, description: "Satu kalimat penjelasan singkat." }
              },
              required: ['title', 'briefDescription']
            }
          }
        },
        required: ['chapters']
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text).chapters;
  }
  throw new Error("Gagal membuat bab.");
};

export const generateSubChapters = async (parentTopic: string, chapterTitle: string, userContext: string): Promise<GeneratedSubChapter[]> => {
  const prompt = `
    Role: Dosen Ahli Spesialis Mata Kuliah.
    Task: Untuk bab "${chapterTitle}" (dalam konteks topik: "${parentTopic}"), uraikan menjadi daftar Sub-bab yang mendetail.
    Context: ${userContext}
    Constraint:
    1. Gunakan Bahasa Indonesia.
    2. **Cakupan**: Buatlah cukup banyak sub-bab (misalnya 5-8 sub-bab) untuk memastikan bab ini dibahas tuntas dan mendalam. Jangan terlalu singkat.
    3. **Format**: Berikan judul sub-bab dan daftar "Poin Pembelajaran" (3-5 butir spesifik per sub-bab).
    4. Poin-poin harus konkret dan siap untuk dijelaskan secara mendalam nanti.
    5. **No Numbering**: JANGAN sertakan nomor sub-bab dalam field title (misal: "1.1. Konsep"). Cukup judulnya saja (misal: "Konsep").
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subChapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Judul Sub-bab (Tanpa Nomor)" },
                learningPoints: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Daftar 3-5 konsep spesifik yang akan dipelajari."
                }
              },
              required: ['title', 'learningPoints']
            }
          }
        },
        required: ['subChapters']
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text).subChapters;
  }
  throw new Error("Gagal membuat sub-bab.");
};

export const generateDetails = async (subChapterTitle: string, contextPath: string, focusPoint: string): Promise<GeneratedDetail> => {
  const prompt = `
    Task: Berikan penjelasan mendalam (deep-dive) SECARA SPESIFIK untuk konsep: "${focusPoint}".
    Context: Ini adalah bagian dari sub-bab "${subChapterTitle}". Konteks user: ${contextPath}.
    
    Constraint:
    1. **Bahasa**: Gunakan Bahasa Indonesia yang jelas, edukatif, dan mengalir enak dibaca.
    2. **Langsung**: Mulailah menjelaskan konsep tersebut secara langsung. JANGAN gunakan frasa pembuka seperti "Sebagai dosen", "Berikut penjelasannya", "Dalam konteks ini", atau basa-basi lainnya. Langsung ke inti materi.
    3. **Fokus**: Fokus EKSKLUSIF pada "${focusPoint}". Jangan merangkum seluruh bab.
    4. **Nada**: Mudah dipahami (seperti menjelaskan pada mahasiswa tahun pertama), namun tetap mendalam.
    5. **Formatting**: 
       - Gunakan **Markdown** secara ketat.
       - Gunakan "### Judul Seksi" untuk memisahkan bagian.
       - Gunakan bullet points "- " untuk daftar.
       - Gunakan **bold** untuk istilah penting.
       - **KRITIKAL**: Pisahkan paragraf dengan baris baru (newline \\n) yang jelas agar teks tidak menumpuk.
    6. **Matematika**:
       - Jika topik melibatkan rumus atau matematika, WAJIB gunakan format **LaTeX**.
       - Gunakan $$ ... $$ untuk persamaan blok (tengah).
       - Gunakan $ ... $ untuk persamaan inline (dalam kalimat).
       - Jangan gunakan format LaTeX pada teks yang sudah bold atau menggunakan format lain.
    7. **Struktur**: 
       - Definisi/Konsep Dasar.
       - Analogi atau Contoh Nyata.
       - Nuansa Teknis atau Detail Penting.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Judul yang menarik untuk konsep ini (Bahasa Indonesia)" },
          comprehensiveExplanation: { type: Type.STRING, description: "Penjelasan detail dalam format Markdown (Bahasa Indonesia)." },
          corePoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Daftar 2-3 kesimpulan utama (Key Takeaways) dari konsep ini."
          }
        },
        required: ['title', 'comprehensiveExplanation', 'corePoints']
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  throw new Error("Gagal membuat penjelasan detail.");
};
