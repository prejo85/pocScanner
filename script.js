const TOTAL_BINS = 50;
const VA_PERCENTAGE = 0.70; 

document.getElementById('fetch-btn').addEventListener('click', loadVolumeProfile);
window.addEventListener('DOMContentLoaded', loadVolumeProfile);

async function loadVolumeProfile() {
    let ticker = document.getElementById('ticker-input').value.toUpperCase().trim();
    const rowsFullContainer = document.getElementById('volume-profile-rows-full');
    const rowsAthContainer = document.getElementById('volume-profile-rows-ath');
    
    rowsFullContainer.innerHTML = '<div class="loading-text">Download storico completo...</div>';
    rowsAthContainer.innerHTML = '<div class="loading-text">Elaborazione dati analitici...</div>';

    // Rilevamento mercati rigido
    let isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(ticker) || ticker.endsWith('USDT');
    let isItalianStock = ticker.endsWith('.MI');
    let isUSStock = !isCrypto && !isItalianStock;

    if (isCrypto && !ticker.endsWith('USDT')) {
        ticker = ticker + 'USDT';
    }

    try {
        let allDataPoints = [];
        let currentPrice = 0;
        let response;

        if (isCrypto) {
            // --- 1. CRYPTO VIA BINANCE (Costruzione nativa senza caratteri speciali espliciti) ---
            const urlObj = new URL("https://binance.com");
            urlObj.searchParams.append("symbol", ticker);
            urlObj.searchParams.append("interval", "1d");
            urlObj.searchParams.append("limit", "1000");

            response = await fetch(urlObj.toString());
            if (!response.ok) throw new Error("Ticker Crypto non trovato.");
            
            const klines = await response.json();
            klines.forEach(candle => {
                // Indici kline Binance: 2=High, 3=Low, 4=Close, 5=Volume
                const high = parseFloat(candle[2]);
                const low = parseFloat(candle[3]);
                const close = parseFloat(candle[4]);
                const volume = parseFloat(candle[5]);
                
                if (!isNaN(high) && !isNaN(low) && !isNaN(close) && !isNaN(volume)) {
                    allDataPoints.push({ high: high, low: low, close: close, volume: volume });
                }
            });
        } 
        else if (isItalianStock) {
            // --- 2. ITALIA VIA YAHOO FINANCE & PROXY ---
            const urlObj = new URL("https://herokuapp.com" + ticker);
            urlObj.searchParams.append("range", "2y");
            urlObj.searchParams.append("interval", "1d");

            response = await fetch(urlObj.toString(), { headers: { "X-Requested-With": "XMLHttpRequest" } });
            if (response.status === 403) {
                throw new Error("Sblocco CORS richiesto. Visita ://herokuapp.com");
            }
            if (!response.ok) throw new Error("Errore nel recupero dati da Yahoo.");
            
            const json = await response.json();
            if (!json.chart || !json.chart.result) throw new Error("Ticker non trovato.");
            
            const result = json.chart.result[0];
            const indicators = result.indicators.quote[0];
            const timestamps = result.timestamp;

            if (timestamps) {
                timestamps.forEach((ts, idx) => {
                    const high = parseFloat(indicators.high[idx]);
                    const low = parseFloat(indicators.low[idx]);
                    const close = parseFloat(indicators.close[idx]);
                    const volume = parseFloat(indicators.volume[idx]);

                    if (!isNaN(high) && !isNaN(low) && !isNaN(close) && !isNaN(volume)) {
                        allDataPoints.push({ high: high, low: low, close: close, volume: volume });
                    }
                });
            }
        } 
        else if (isUSStock) {
            // --- 3. USA VIA STOOQ DATABASE ---
            const stooqTicker = ticker.includes('.') ? ticker : ticker + ".US";
            const urlObj = new URL("https://stooq.com");
            urlObj.searchParams.append("s", stooqTicker);
            urlObj.searchParams.append("i", "d");
            
            response = await fetch(urlObj.toString());
            if (!response.ok) throw new Error("Database Stooq non raggiungibile.");
            
            const csvText = await response.text();
            const lines = csvText.split('\n');
            
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',');
                if (row.length >= 6) {
                    // Struttura CSV Stooq: 2=High, 3=Low, 4=Close, 5=Volume
                    const high = parseFloat(row[2]);
                    const low = parseFloat(row[3]);
                    const close = parseFloat(row[4]);
                    const volume = parseFloat(row[5]);

                    if (!isNaN(high) && !isNaN(low) && !isNaN(close) && !isNaN(volume)) {
                        allDataPoints.push({ high: high, low: low, close: close, volume: volume });
                    }
                }
            }
            allDataPoints.reverse();
        }

        if (allDataPoints.length === 0) {
            throw new Error("Nessun dato valido estratto. Controlla il ticker.");
        }

        currentPrice = allDataPoints[allDataPoints.length - 1].close;

        let athMaxPrice = -Infinity;
        let athIndex = 0;

        allDataPoints.forEach((point, index) => {
            if (point.high > athMaxPrice) {
                athMaxPrice = point.high;
                athIndex = index;
            }
        });

        const fullHistoryData = allDataPoints;
        const athToPresentData = allDataPoints.slice(athIndex);
        const cleanDisplayTicker = ticker.replace('USDT', '');

        renderIndependentProfile(fullHistoryData, rowsFullContainer, 'poc-display-full', 'va-display-full', cleanDisplayTicker, currentPrice);
        renderIndependentProfile(athToPresentData, rowsAthContainer, 'poc-display-ath', 'va-display-ath', cleanDisplayTicker, currentPrice);

    } catch (error) {
        rowsFullContainer.innerHTML = "<div class='loading-text' style='color: #ef4444;'>Errore: " + error.message + "</div>";
        rowsAthContainer.innerHTML = "<div class='loading-text' style='color: #ef4444;'>Errore: " + error.message + "</div>";
    }
}
function renderIndependentProfile(dataset, container, pocId, vaId, ticker, currentPrice) {
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    dataset.forEach(d => {
        if (d.high > maxPrice) maxPrice = d.high;
        if (d.low < minPrice) minPrice = d.low;
    });

    const binSize = (maxPrice - minPrice) / TOTAL_BINS;
    
    const bins = Array.from({ length: TOTAL_BINS }, (_, i) => {
        return {
            index: i,
            lowPrice: minPrice + (i * binSize),
            highPrice: minPrice + ((i + 1) * binSize),
            volume: 0,
            isInVA: false
        };
    });

    let totalVolume = 0;

    dataset.forEach(candle => {
        const candleRange = candle.high - candle.low;
        if (candleRange === 0) {
            const targetBin = bins.find(b => candle.close >= b.lowPrice && candle.close <= b.highPrice);
            if (targetBin) {
                targetBin.volume += candle.volume;
                totalVolume += candle.volume;
            }
            return;
        }

        bins.forEach(bin => {
            const overlapLow = Math.max(candle.low, bin.lowPrice);
            const overlapHigh = Math.min(candle.high, bin.highPrice);
            if (overlapHigh > overlapLow) {
                const weight = (overlapHigh - overlapLow) / candleRange;
                const distributedVolume = candle.volume * weight;
                bin.volume += distributedVolume;
                totalVolume += distributedVolume;
            }
        });
    });

    let maxVolume = 0;
    let pocIndex = 0;
    bins.forEach((bin, idx) => {
        if (bin.volume > maxVolume) {
            maxVolume = bin.volume;
            pocIndex = idx;
        }
    });

    const targetVolume = totalVolume * VA_PERCENTAGE;
    bins[pocIndex].isInVA = true;
    let currentVACount = bins[pocIndex].volume;

    let upIdx = pocIndex + 1;
    let downIdx = pocIndex - 1;

    while (currentVACount < targetVolume && (upIdx < TOTAL_BINS || downIdx >= 0)) {
        let volUp = upIdx < TOTAL_BINS ? bins[upIdx].volume : 0;
        let volDown = downIdx >= 0 ? bins[downIdx].volume : 0;

        if (volUp >= volDown && upIdx < TOTAL_BINS) {
            bins[upIdx].isInVA = true;
            currentVACount += bins[upIdx].volume;
            upIdx++;
        } else if (downIdx >= 0) {
            bins[downIdx].isInVA = true;
            currentVACount += bins[downIdx].volume;
            downIdx--;
        } else if (upIdx < TOTAL_BINS) {
            bins[upIdx].isInVA = true;
            currentVACount += bins[upIdx].volume;
            upIdx++;
        }
    }

    const vaIndices = bins.filter(b => b.isInVA).map(b => b.index);
    const highestVAIndex = vaIndices.length > 0 ? Math.max(...vaIndices) : pocIndex;
    const lowestVAIndex = vaIndices.length > 0 ? Math.min(...vaIndices) : pocIndex;

    const valPrice = bins[lowestVAIndex] ? bins[lowestVAIndex].lowPrice : minPrice;
    const vahPrice = bins[highestVAIndex] ? bins[highestVAIndex].highPrice : maxPrice;

    container.innerHTML = '';

    [...bins].reverse().forEach(bin => {
        const percentage = maxVolume > 0 ? (bin.volume / maxVolume) * 100 : 0;
        const isPoc = (bin.index === pocIndex);
        const avgPrice = ((bin.lowPrice + bin.highPrice) / 2).toFixed(2);

        let rowClasses = 'profile-row';
        if (isPoc) rowClasses += ' poc';
        if (bin.isInVA) rowClasses += ' in-value-area';
        if (bin.index === highestVAIndex) rowClasses += ' vah-border';
        if (bin.index === lowestVAIndex) rowClasses += ' val-border';

        if (currentPrice >= bin.lowPrice && currentPrice <= bin.highPrice) {
            rowClasses += ' current-price-border';
        }

        const rowElement = document.createElement('div');
        rowElement.className = rowClasses;
        
        const isCurrentBin = rowClasses.includes('current-price-border');
        const priceLabelText = isCurrentBin ? "$" + currentPrice.toFixed(2) : "$" + avgPrice;

        rowElement.innerHTML = '<div class="price-label">' + priceLabelText + '</div>' +
                               '<div class="bar-container">' +
                               '<div class="volume-bar" style="--volume-percentage: ' + percentage + '"></div>' +
                               '</div>';
        container.appendChild(rowElement);
    });

    const pocPriceAvg = ((bins[pocIndex].lowPrice + bins[pocIndex].highPrice) / 2).toFixed(2);
    document.getElementById(pocId).innerText = ticker + ' $' + pocPriceAvg;
    document.getElementById(vaId).innerText = '' + valPrice.toFixed(2) + ' - ' + vahPrice.toFixed(2);
}
