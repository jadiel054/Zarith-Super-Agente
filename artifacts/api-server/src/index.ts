import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();

// Configurações Iniciais
app.use(cors());
app.use(bodyParser.json());

// Conexão com MongoDB (Atualizada conforme sua leitura)
// Nota: Substitua 'localhost' pela sua string de conexão do Atlas se necessário
mongoose.connect('mongodb://localhost:27017/nosso-projeto', {
  useNewUrlParser: true,
  useUnifiedTopology: true
} as mongoose.ConnectOptions)
  .then(() => console.log('✅ Conectado ao MongoDB com sucesso!'))
  .catch(err => console.error('❌ Erro de conexão ao MongoDB:', err));

// Definição Simples de Schema/Model (Exemplo baseado na sua leitura de /users)
const UserSchema = new mongoose.Schema({
  name: String,
  email: String
});
const User = mongoose.model('User', UserSchema);

// --- ROTAS MELHORADAS (TRY/CATCH + NEXT) ---

app.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    next(error); // Encaminha o erro para o Middleware Global
  }
});

app.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = new User(req.body);
    const savedUser = await user.save();
    res.status(201).json(savedUser);
  } catch (error) {
    // Diferencia erro de validação (400) de erro interno (500)
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: 'Erro de validação nos dados do usuário', details: error.errors });
    }
    next(error);
  }
});

// --- MIDDLEWARE GLOBAL DE ERROS (SUGESTÃO DA ZARITH) ---
// Este bloco garante que o cliente SEMPRE receba uma resposta estruturada.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('⚠️ [Zarith Error Monitor]:', err.stack);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Ocorreu um erro interno no servidor.',
    // Mostra o stack de erro apenas em desenvolvimento para segurança
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Zarith rodando na porta ${PORT}`);
});
    
