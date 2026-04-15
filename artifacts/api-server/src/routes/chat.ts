router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    
    // 1. Resposta da Claude (mantenha sua lógica atual)
    const aiResponse = "Sim, Meu Criador! Estou funcionando perfeitamente agora!"; 

    // 2. Em vez de gerar o arquivo MP3 aqui (que o celular bloqueia),
    // vamos enviar o texto com uma instrução de voz.
    res.status(200).json({
      text: aiResponse,
      shouldSpeak: true, // Instrução para o front-end
      voiceConfig: { lang: 'pt-BR', rate: 1.0 }
    });

  } catch (error) {
    res.status(500).json({ error: "Erro no sistema" });
  }
});
