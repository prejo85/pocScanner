const TOTAL_BINS = 45; 
const VA_PERCENTAGE = 0.70; 

// Reset completo della cache per evitare conflitti con vecchi calcoli
sessionStorage.clear();

const marketDatabase = {
    USA: [
        { ticker: "AAPL", name: "Apple Inc." },
        { ticker: "MSFT", name: "Microsoft Corp." },
        { ticker: "NVDA", name: "NVIDIA Corp." },
        { ticker: "TSLA", name: "Tesla Inc." },
        { ticker: "AMZN", name: "Amazon.com Inc." },
        { ticker: "META", name: "Meta Platforms" },
        { ticker: "GOOGL", name: "Alphabet Inc." },
        { ticker: "AMD", name: "Advanced Micro Devices" }
    ],
    ITA: [
        { ticker: "STLAM.MIL", name: "Stellantis N.V." },
        { ticker: "RACE.MIL", name: "Ferrari N.V." },
        { ticker: "ENI.MIL", name: "Eni S.p.A." },
        { ticker: "ISP.MIL", name: "Intesa Sanpaolo" },
        { ticker: "UCG.MIL", name: "Unicredit S.p.A." },
        { ticker: "ENEL.MIL", name: "Enel S.p.A." },
        { ticker: "STMMI.MIL", name: "STMicroelectronics" },
        { ticker: "G.MIL", name: "Assicurazioni Generali" }
    ],
    CRYPTO: [
        { ticker: "BTC", name: "Bitcoin (BTC)" },
        { ticker: "ETH", name: "Ethereum (ETH)" },
        { ticker: "SOL", name: "Solana (SOL)" },
        { ticker: "BNB", name: "BNB (BNB)" },
        { ticker: "XRP", name: "Ripple (XRP)" }
    ]
};
window.addEventListener('load', () => {
    setupMarketSelector();
    updateTickerSelect("USA"); 
    loadVolumeProfile();       
    
    const selectEl = document.getElementById('ticker-select');
    if (selectEl) {
        selectEl.addEventListener('change', loadVolumeProfile);
    }
});

document.getElementById('fetch-btn').addEventListener('click', loadVolumeProfile);

function setupMarketSelector() {
    const buttons = document.querySelectorAll('.market-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            buttons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const selectedMarket = e.target.getAttribute('data-market');
            updateTickerSelect(selectedMarket);
            loadVolumeProfile();
        });
    });
}

function updateTickerSelect(marketKey) {
    const selectEl = document.getElementById('ticker-select');
    if (!selectEl) return;
    selectEl.innerHTML = ''; 
    marketDatabase[marketKey].forEach(item => {
        const option = document.createElement('option');
        option.value = item.ticker;
        option.text = item.ticker + " - " + item.name;
        selectEl.appendChild(option);
    });
}
async function loadVolumeProfile() {
    const selectEl = document.getElementById('ticker-select');
    if (!selectEl) return;
    
    let ticker = selectEl.value; 
    const rowsFullContainer = document.getElementById('volume-profile-rows-full');
    const rowsAthContainer = document.getElementById('volume-profile-rows-ath');
    
    if (!rowsFullContainer || !rowsAthContainer) return;

    rowsFullContainer.innerHTML = '<div class="loading-text">Calcolo POC e Distribuzione Volumi Storici...</div>';
    rowsAthContainer.innerHTML = '<div class="loading-text">Calcolo Analitico dal Massimo Storico (ATH)...</div>';

    // Avvia l'inizializzazione del grafico ufficiale TradingView
    renderTradingViewWidget(ticker);

    let data;
    const PRIMARY_KEY = "DXEHNXKL0G33RM7N"; 
    const dominio = 'https://alphavantage.co';
    const endpoint = '/query';
    const isCrypto = marketDatabase.CRYPTO.some(c => c.ticker === ticker);

    try {
        let parametri = isCrypto 
            ? "function=DIGITAL_CURRENCY_DAILY&symbol=" + ticker + "&market=USD&apikey=" + PRIMARY_KEY
            : "function=TIME_SERIES_DAILY&symbol=" + ticker + "&outputsize=full&apikey=" + PRIMARY_KEY;

        const response = await fetch(dominio + endpoint + "?" + parametri);
        if (!response.ok) throw new Error("Errore di connessione di rete.");
        data = await response.json();

        if (data["Note"] || data["Information"]) {
            throw new Error("Chiave API sature. Attendi un minuto per i dati di volume.");
        }
        if (data["Error Message"]) {
            throw new Error("Asset non riconosciuto dai server volumetrici.");
        }

        let allDataPoints = [];
        let absoluteMaxPrice = -Infinity;
        let athIndex = 0;

        const timeSeriesKey = Object.keys(data).find(key => 
            key.toLowerCase().includes("time series") || 
            key.toLowerCase().includes("digital currency") ||
            key.toLowerCase().includes("daily")
        );

        if (!timeSeriesKey) throw new Error("Struttura dati non riconosciuta.");

        const timeSeries = data[timeSeriesKey];
        const sortedDates = Object.keys(timeSeries).sort((a, b) => new Date(a) - new Date(b));
        
        const latestCloseKey = Object.keys(timeSeries[sortedDates[sortedDates.length - 1]]).find(k => k.toLowerCase().includes("close"));
        let currentPrice = parseFloat(timeSeries[sortedDates[sortedDates.length - 1]][latestCloseKey]);

        sortedDates.forEach((date) => {
            const dayData = timeSeries[date];
            const highKey = Object.keys(dayData).find(k => k.toLowerCase().includes("high"));
            const lowKey = Object.keys(dayData).find(k => k.toLowerCase().includes("low"));
            const closeKey = Object.keys(dayData).find(k => k.toLowerCase().includes("close"));
            const volumeKey = Object.keys(dayData).find(k => k.toLowerCase().includes("volume"));

            const high = parseFloat(dayData[highKey]);
            const low = parseFloat(dayData[lowKey]);
            const close = parseFloat(dayData[closeKey]);
            const volume = parseFloat(dayData[volumeKey]);

            if (!isNaN(high) && !isNaN(low) && !isNaN(close) && !isNaN(volume)) {
                allDataPoints.push({ date, high, low, close, volume });

                if (high > absoluteMaxPrice) {
                    absoluteMaxPrice = high;
                    athIndex = allDataPoints.length - 1; 
                }
            }
        });

        renderSingleProfile(allDataPoints, rowsFullContainer, 'poc-display-full', 'va-display-full', ticker, currentPrice);
        renderSingleProfile(allDataPoints.slice(athIndex), rowsAthContainer, 'poc-display-ath', 'va-display-ath', ticker, currentPrice);

    } catch (error) {
        rowsFullContainer.innerHTML = '<div class="loading-text" style="color: #ef4444;">' + error.message + '</div>';
        rowsAthContainer.innerHTML = '<div class="loading-text" style="color: #ef4444;">Impossibile calcolare i volumi storici su dati assenti.</div>';
    }
}
function renderTradingViewWidget(ticker) {
    let formattedSymbol = ticker;

    if (ticker === "BTC" || ticker === "ETH" || ticker === "SOL" || ticker === "BNB" || ticker === "XRP") {
        formattedSymbol = "BINANCE:" + ticker + "USD";
    } else if (ticker.endsWith(".MIL")) {
        formattedSymbol = "MILAN:" + ticker.replace(".MIL", "");
    } else {
        formattedSymbol = "NASDAQ:" + ticker;
    }

    if (typeof TradingView !== 'undefined') {
        new TradingView.widget({
            "autosize": true,
            "symbol": formattedSymbol,
            "interval": "D",
            "timezone": "Europe/Rome",
            "theme": "dark",
            "style": "1",
            "locale": "it",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "hide_legend": false,
            "saveimage": false,
            "container_id": "tv-chart-widget"
        });
    }
}
function renderSingleProfile(dataset, container, pocId, vaId, ticker, currentPrice) {
    if (dataset.length === 0) return;
    
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
        for (let i = 0; i < TOTAL_BINS; i++) {
            if (candle.close >= bins[i].lowPrice && candle.close <= bins[i].highPrice) {
                bins[i].volume += candle.volume;
                totalVolume += candle.volume;
                break;
            }
        }
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
        }
    }

    const vaIndices = bins.filter(b => b.isInVA).map(b => b.index);
    const highestVAIndex = Math.max(...vaIndices);
    const lowestVAIndex = Math.min(...vaIndices);

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
        const priceLabelText = rowClasses.includes('current-price-border') ? ('' + currentPrice.toFixed(2)) : ('' + avgPrice);

        rowElement.innerHTML = '<div class="price-label">$' + priceLabelText + '</div>' +
                               '<div class="bar-container">' +
                               '<div class="volume-bar" style="--volume-percentage: ' + percentage + '"></div>' +
                               '</div>';
        container.appendChild(rowElement);
    });

    const pocPriceAvg = ((bins[pocIndex].lowPrice + bins[pocIndex].highPrice) / 2).toFixed(2);
    const pocDisplayEl = document.getElementById(pocId);
    const vaDisplayEl = document.getElementById(vaId);
    
    let tickerClean = ticker.includes(".MIL") ? ticker.replace(".MIL", "") : ticker;
    if (pocDisplayEl) pocDisplayEl.innerText = tickerClean + " $" + pocPriceAvg;
    if (vaDisplayEl) vaDisplayEl.innerText = "$" + valPrice.toFixed(2) + " - $" + vahPrice.toFixed(2);
}
