// Number to words converter for Spanish
// Handles numbers up to 9,999,999.99

const unidades = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'
];
const decenas = [
  '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
];
const especiales = [ // For 10-19
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'
];
const centenas = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
];

function convertirSegmento(n: number): string {
    if (n < 0 || n > 999) return ""; // Handles segments of 3 digits

    let parts: string[] = [];

    const c = Math.floor(n / 100); // Hundreds digit
    const resto = n % 100;         // Remainder for tens and units

    if (c > 0) {
        if (c === 1 && resto === 0) { // Exactly 100
            parts.push('CIEN');
        } else {
            parts.push(centenas[c]); // e.g., CIENTO, DOSCIENTOS. centenas[1] is CIENTO
        }
    }

    if (resto > 0) {
        const d = Math.floor(resto / 10); // Tens digit of the remainder
        const u = resto % 10;             // Units digit of the remainder

        if (resto >= 10 && resto <= 19) {
            parts.push(especiales[resto - 10]);
        } else if (resto >= 20 && resto <= 29) {
            if (resto === 20) {
                parts.push('VEINTE');
            } else {
                parts.push('VEINTI' + unidades[u]);
            }
        } else { // Handles 0-9 and 30-99
            if (d >= 3) { // 30-99
                parts.push(decenas[d]);
                if (u > 0) {
                    parts.push('Y');
                    parts.push(unidades[u]);
                }
            } else if (u > 0) { // Handles units 1-9
                parts.push(unidades[u]);
            }
        }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}


function convertirParteEntera(n: number): string {
    if (n === 0) return 'CERO';
    if (n < 0) return ""; // Or handle negative numbers appropriately

    let parts: string[] = [];
    const millones = Math.floor(n / 1000000);
    const miles = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;

    if (millones > 0) {
        if (millones === 1) {
            parts.push('UN MILLON');
        } else {
            parts.push(convertirSegmento(millones)); // Convert millions part
            parts.push('MILLONES');
        }
    }

    if (miles > 0) {
        if (miles === 1 && millones === 0) { // "MIL" not "UN MIL" unless it's like "UN MILLON MIL"
            parts.push('MIL');
        } else if (miles > 0) { // For numbers like 2000, 11000, etc.
             const textoMiles = convertirSegmento(miles);
             if(textoMiles) parts.push(textoMiles);
             if(miles > 1 || (millones > 0 && textoMiles) || (millones === 0 && textoMiles !== "UNO") ) { // "DOS MIL", "UN MILLON DOS MIL", but "MIL" not "UNO MIL"
                parts.push('MIL');
             } else if (millones === 0 && miles === 1 && textoMiles === "UNO"){ // Special case for "UN MIL" if it was "UNO MIL"
                parts.pop(); // remove "UNO"
                parts.push('MIL');
             } else if (millones === 0 && textoMiles) { //Handles "MIL" when miles segment is 1
                parts.push('MIL');
             }

        }
    }
    
    if (resto > 0) {
        const textoResto = convertirSegmento(resto);
        if (textoResto) {
             parts.push(textoResto);
        }
    } else if (n > 0 && millones === 0 && miles === 0 && resto === 0) {
        // This case should not happen if n > 0. If n was initially 0, it's caught.
        // If n was say 1000, resto is 0, but miles > 0, so parts is already ["MIL"]
    }


    // Edge case: if only "UNO" is generated for 1000, replace with "MIL"
    if (parts.length === 1 && parts[0] === "UNO" && n === 1000) {
        return "MIL";
    }
    // Edge case: if only "UNO" is generated for 1_000_000, replace with "UN MILLON" (already handled)

    return parts.join(' ').replace(/\s+/g, ' ').trim();
}


const MONEDA_MAP: { [key: string]: { singular: string, plural: string, short: string } } = {
  cordoba: { singular: 'CORDOBA', plural: 'CORDOBAS', short: 'C$' },
  dolar: { singular: 'DOLAR', plural: 'DOLARES', short: 'US$' },
  euro: { singular: 'EURO', plural: 'EUROS', short: '€' }
};

export function numeroALetras(numero?: number | string, moneda?: string): string {
  if (numero === undefined || numero === null || numero === '' || moneda === undefined) {
    return '';
  }

  const num = Number(numero);
  if (isNaN(num) || num < 0) {
    return '';
  }

  const monedaInfo = MONEDA_MAP[moneda] || { singular: moneda.toUpperCase(), plural: moneda.toUpperCase(), short: '' };
  
  if (num === 0) return `CERO CON 00/100 ${monedaInfo.plural}`;

  const [enteroStr, decimalStr = '00'] = String(num.toFixed(2)).split('.');
  const entero = parseInt(enteroStr, 10);
  
  let letrasEntero = convertirParteEntera(entero);
  // Special case for "UNO" before currency, should be "UN" if it's just "UNO"
  if (letrasEntero === 'UNO' && entero === 1) {
      letrasEntero = 'UN';
  }

  const decimalFormateado = decimalStr.padEnd(2, '0');
  
  const monedaTexto = (entero === 1 && letrasEntero === 'UN') ? monedaInfo.singular : monedaInfo.plural; 

  return `${letrasEntero} CON ${decimalFormateado}/100 ${monedaTexto}`.toUpperCase();
}
