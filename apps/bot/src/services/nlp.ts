import { logger } from '../logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface TradeIntent {
  action: 'buy' | 'sell' | 'long' | 'short';
  asset: 'BTC' | 'ETH' | 'SOL';
  amount?: number;
  leverage?: number;
  isValid: boolean;
  confidence: number;
  rawText: string;
  reasoning?: string; // Added to include LLM reasoning
}

// Initialize Gemini 2 Flash
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  logger.warn('GEMINI_API_KEY not set - falling back to regex parsing');
}

/**
 * Parse natural language trading commands using Gemini 2 Flash
 * Examples:
 * - "buy 100 btc"
 * - "short eth 50 usdc"  
 * - "long sol with 3x leverage"
 * - "I want to go long on bitcoin with $500"
 * - "sell all my ethereum"
 * - "take a short position on solana"
 */
export async function parseTradeCommand(text: string): Promise<TradeIntent> {
  // If Gemini is available, use it for intelligent parsing
  if (genAI) {
    try {
      return await parseWithGemini(text);
    } catch (error) {
      logger.error({ error, text }, 'Gemini parsing failed, falling back to regex');
      // Fall back to regex parsing
    }
  }
  
  // Fallback to regex-based parsing
  return parseWithRegex(text);
}

/**
 * Parse trading commands using Gemini 2 Flash LLM
 */
async function parseWithGemini(text: string): Promise<TradeIntent> {
  const model = genAI!.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  const prompt = `You are a trading command parser for Hyperliquid perpetuals. 
Parse this natural language command into a structured trading intent.

Available assets: BTC, ETH, SOL
Available actions: buy, sell, long, short

Command: "${text}"

Respond with ONLY a JSON object in this exact format (no markdown, no explanations):
{
  "action": "buy|sell|long|short",
  "asset": "BTC|ETH|SOL", 
  "amount": number or null,
  "leverage": number or null,
  "isValid": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of parsing"
}

Rules:
- If the command is clearly not about trading, set isValid: false, confidence: 0.0
- Default leverage is 1 if not specified
- Amount should be in USD if mentioned (parse from phrases like "$50", "100 usdc", "fifty dollars")
- Use confidence 0.8-1.0 for clear commands, 0.5-0.7 for ambiguous, 0.0-0.4 for unclear
- Set isValid: true only if both action and asset are clearly identified
- For phrases like "all my btc" or "my entire position", set amount: null (will use available balance)

Examples:
"buy 100 btc" → {"action": "buy", "asset": "BTC", "amount": 100, "leverage": 1, "isValid": true, "confidence": 0.95, "reasoning": "Clear buy order for BTC with $100"}
"go long ethereum" → {"action": "long", "asset": "ETH", "amount": null, "leverage": 1, "isValid": true, "confidence": 0.85, "reasoning": "Long position on ETH, no amount specified"}
"what's the weather" → {"action": "buy", "asset": "BTC", "amount": null, "leverage": 1, "isValid": false, "confidence": 0.0, "reasoning": "Not a trading command"}`;

  const result = await model.generateContent(prompt);
  const response = result.response.text().trim();
  
  logger.info({ text, geminiResponse: response }, 'Gemini parsing response');
  
  try {
    const parsed = JSON.parse(response);
    return {
      action: parsed.action || 'buy',
      asset: parsed.asset || 'BTC',
      amount: parsed.amount,
      leverage: parsed.leverage || 1,
      isValid: parsed.isValid || false,
      confidence: parsed.confidence || 0.0,
      rawText: text,
      reasoning: parsed.reasoning || '',
    };
  } catch (parseError) {
    logger.error({ parseError, response }, 'Failed to parse Gemini JSON response');
    throw new Error('Invalid JSON response from Gemini');
  }
}

/**
 * Fallback regex-based parsing (original implementation)
 */
function parseWithRegex(text: string): TradeIntent {
  const normalized = text.toLowerCase().trim();
  logger.info({ text: normalized }, 'Parsing trade command');

  // Initialize default result
  const result: TradeIntent = {
    action: 'buy',
    asset: 'BTC',
    amount: undefined,
    leverage: 1,
    isValid: false,
    confidence: 0,
    rawText: text,
  };

  // Extract action words
  const buyWords = ['buy', 'long', 'bull', 'bullish'];
  const sellWords = ['sell', 'short', 'bear', 'bearish', 'dump'];
  
  let actionFound = false;
  for (const word of buyWords) {
    if (normalized.includes(word)) {
      result.action = word === 'buy' ? 'buy' : 'long';
      actionFound = true;
      result.confidence += 0.3;
      break;
    }
  }
  
  if (!actionFound) {
    for (const word of sellWords) {
      if (normalized.includes(word)) {
        result.action = word === 'sell' ? 'sell' : 'short';
        actionFound = true;
        result.confidence += 0.3;
        break;
      }
    }
  }

  // Extract asset
  const assets = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana'];
  let assetFound = false;
  
  for (const asset of assets) {
    if (normalized.includes(asset)) {
      if (asset.includes('btc') || asset.includes('bitcoin')) {
        result.asset = 'BTC';
      } else if (asset.includes('eth') || asset.includes('ethereum')) {
        result.asset = 'ETH';
      } else if (asset.includes('sol') || asset.includes('solana')) {
        result.asset = 'SOL';
      }
      assetFound = true;
      result.confidence += 0.4;
      break;
    }
  }

  // Extract amount (look for numbers followed by usdc, usd, or $)
  const amountRegex = /(\d+(?:\.\d+)?)\s*(?:usdc?|usd|\$)/i;
  const amountMatch = normalized.match(amountRegex);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1]);
    result.confidence += 0.2;
  }

  // Extract leverage
  const leverageRegex = /(\d+(?:\.\d+)?)\s*x?\s*(?:leverage|lev)/i;
  const leverageMatch = normalized.match(leverageRegex);
  if (leverageMatch) {
    result.leverage = parseFloat(leverageMatch[1]);
    result.confidence += 0.1;
  }

  // Check if command is valid (needs action and asset at minimum)
  result.isValid = actionFound && assetFound && result.confidence >= 0.6;

  logger.info({ result }, 'Trade command parsed');
  return result;
}

/**
 * Format trade intent for user confirmation
 */
export function formatTradePreview(intent: TradeIntent): string {
  const { action, asset, amount, leverage, reasoning } = intent;
  
  const emoji = action === 'buy' || action === 'long' ? '📈' : '📉';
  const actionText = action.toUpperCase();
  const leverageText = leverage && leverage > 1 ? ` (${leverage}x leverage)` : '';
  const amountText = amount ? `$${amount} ` : '';
  const reasoningText = reasoning ? `\n\n🤖 *AI Analysis:* ${reasoning}` : '';
  
  return `${emoji} *Trade Preview*

*Action:* ${actionText} ${asset}${leverageText}
*Amount:* ${amountText || 'Will use available balance'}
*Market:* Hyperliquid Perpetuals${reasoningText}

⚠️ *Confirm this trade?*
• This will place a market order
• Execution happens immediately
• Fees: ~0.02% taker fee`;
}

/**
 * Suggest corrections for invalid commands or provide guidance
 */
export function suggestCorrection(intent: TradeIntent): string {
  // If confidence is very low, it's likely not a trading command at all
  if (intent.confidence < 0.2) {
    return `🤖 *Hi there!* 

I'm your trading assistant. To place a trade, try:

*💬 Natural Language:*
• "buy 50 btc"
• "long eth with 2x leverage"
• "short 100 sol"

*📋 Or use commands:*
• \`/balance\` - Check your funds
• \`/fund\` - Deposit USDC
• \`/help\` - See all commands

*🎯 Need help?* Type \`/help\` for the complete guide!`;
  }

  // For partial matches, provide specific guidance
  const issues: string[] = [];
  
  if (intent.confidence < 0.3) {
    issues.push("I couldn't understand the action (try: buy, sell, long, short)");
  }
  
  if (!['BTC', 'ETH', 'SOL'].includes(intent.asset) || intent.confidence < 0.4) {
    issues.push("Specify the asset (BTC, ETH, or SOL)");
  }
  
  const examples = [
    "• `buy 50 btc`",
    "• `short eth 100 usdc`", 
    "• `long sol with 2x leverage`",
    "• `sell btc`"
  ];
  
  return `❌ *Almost there!*

${issues.join('\n')}

*Try these formats:*
${examples.join('\n')}

💡 *Tip:* Use \`/help\` to see all available commands.`;
}
