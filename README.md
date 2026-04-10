# 💀 Crime.Life Bot - Extensão Chrome

Bot automatizado para o jogo Crime.Life, baseado nas mecânicas do wiki oficial.

## 📦 Instalação

1. **Baixe e extraia** o arquivo ZIP da extensão
2. Abra o Chrome e acesse: `chrome://extensions/`
3. Ative o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **"Carregar sem compactação"**
5. Selecione a pasta `crimelife-bot`
6. A extensão aparecerá na barra do Chrome ✅

## 🎮 Como Usar

### Overlay no Jogo
- Acesse **crime.life** no navegador
- Um painel aparecerá no **canto inferior esquerdo** da tela
- Clique no botão **LIGAR/DESLIGAR** para ativar o bot
- O indicador LED ficará verde quando ativo

### Popup da Extensão
- Clique no ícone da extensão na barra do Chrome
- Veja estatísticas, logs e configure o bot
- Toggle principal para ligar/desligar

## ⚙️ Configurações

| Opção | Descrição |
|-------|-----------|
| **Auto Crime** | Executa crimes automaticamente |
| **Modo de Operação** | Escolhe o crime que o bot deve procurar |

Crimes disponíveis:
- Roubar Doces de uma Criança
- Roubar Roupa do Estendal
- Carteirista
- Assaltar um Turista
- Laboratório Narcos

## 🕐 Ciclos Horários

O bot respeita os ciclos do jogo (baseado no wiki):

| Horário | Ciclo | Crime | Treino |
|---------|-------|-------|--------|
| 23:00 - 04:59 | Alta Noite | +40% | -30% |
| 05:00 - 06:59 | Madrugada | +10% | +10% |
| 07:00 - 11:59 | Manhã | -10% | +20% |
| 12:00 - 16:59 | Dia | -20% | ⚠️ |
| 17:00 - 19:59 | Fim da Tarde | +20% | -10% |
| 20:00 - 22:59 | Noite | +30% | -20% |

## 📋 Estratégia Automática

- **Alta Noite / Noite:** Prioriza crimes (+30-40%)
- **Manhã:** Mantém monitoramento sem priorizar treino automático
- **Dia:** Evita crimes no modo seguro (risco máximo de prisão)
- **Energia baixa:** Aguarda recuperação passiva (1/min)

## ⚠️ Aviso

Esta extensão foi criada para fins educacionais. Use com responsabilidade e respeite os termos de serviço do jogo.

---
*Baseado no wiki oficial: https://wiki.crime.life/index.php?title=Main_Page_PT*
