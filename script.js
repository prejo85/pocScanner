const TOTAL_BINS = 45; 
const VA_PERCENTAGE = 0.70; 

// Svuota i residui di memoria prima di iniziare
sessionStorage.clear();

// RIPRISTINATO IL DATABASE COMPLETO DI TUTTE LE AZIENDE
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

window.addEventListener('DOMContentLoaded', () => {
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
    const chartContainer = document.getElementById('main-price-chart');
    
    if (!rowsFullContainer || !rowsAthContainer) return;

    rowsFullContainer.innerHTML = '<div class="loading-text">Elaborazione dati...</div>';
    rowsAthContainer.innerHTML = '<div class="loading-text">Elaborazione dati...</div>';
    if (chartContainer) chartContainer.innerHTML = '<div class="loading-text-chart">Caricamento grafico interattivo...</div>';

    let data = { "Time Series (Daily)": {} };
    
    // Calibrazione dinamica del prezzo simulato per evitare errori di calcolo matematici
    let basePrice = 150;
    if (ticker === "BTC") basePrice = 65000;
    else if (ticker === "ETH") basePrice = 3400;
    else if (ticker === "SOL") basePrice = 140;
    else if (ticker === "BNB") basePrice = 580;
    else if (ticker === "XRP") basePrice = 0.60;
    else if (ticker.endsWith(".MIL")) basePrice = 18; 

    let currentDate = new Date();
    for (let i = 0; i < 100; i++) {
        let yyyy = currentDate.getFullYear();
        let mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        let dd = String(currentDate.getDate()).padStart(2, '0');
        let dateStr = yyyy + "-" + mm + "-" + dd;

        let change = (Math.random() - 0.49) * (basePrice * 0.02);
        let open = basePrice;
        let close = basePrice + change;
        let high = Math.max(open, close) + (Math.random() * (basePrice * 0.01));
        let low = Math.min(open, close) - (Math.random() * (basePrice * 0.01));
        let volume = Math.floor(Math.random() * 2000000) + 100000;
        
        data["Time Series (Daily)"][dateStr] = {
            "1. open": open.toFixed(2),
            "2. high": high.toFixed(2),
            "3. low": low.toFixed(2),
            "4. close": close.toFixed(2),
            "5. volume": volume.toString()
        };
        basePrice = close;
        currentDate.setDate(currentDate.getDate() - 1);
    }

    try {
        let allDataPoints = [];
        let absoluteMaxPrice = -Infinity;
        let athIndex = 0;
        
        const timeSeries = data["Time Series (Daily)"];
        const sortedDates = Object.keys(timeSeries).sort((a, b) => new Date(a) - new Date(b));
        let currentPrice = parseFloat(timeSeries[sortedDates[sortedDates.length - 1]]["4. close"]);

        sortedDates.forEach((date) => {
            const dayData = timeSeries[date];
            const high = parseFloat(dayData["2. high"]);
            const low = parseFloat(dayData["3. low"]);
            const close = parseFloat(dayData["4. close"]);
            const volume = parseFloat(dayData["5. volume"]);

            allDataPoints.push({ date, high, low, close, volume });

            if (high > absoluteMaxPrice) {
                absoluteMaxPrice = high;
                athIndex = allDataPoints.length - 1; 
            }
        });

        if (chartContainer) {
            renderTradingViewWidget(chartContainer, ticker);
        }

        const fullHistoryData = allDataPoints;
        const athToPresentData = allDataPoints.slice(athIndex);

        renderSingleProfile(fullHistoryData, rowsFullContainer, 'poc-display-full', 'va-display-full', ticker, currentPrice);
        renderSingleProfile(athToPresentData, rowsAthContainer, 'poc-display-ath', 'va-display-ath', ticker, currentPrice);

    } catch (error) {
        if (chartContainer) chartContainer.innerHTML = '<div class="loading-text-chart" style="color: #ef4444;">Errore: ' + error.message + '</div>';
    }
}
function renderTradingViewWidget(container, ticker) {
    container.innerHTML = ''; 
    let formattedSymbol = ticker;

    if (ticker === "BTC" || ticker === "ETH" || ticker === "SOL" || ticker === "BNB" || ticker === "XRP") {
        formattedSymbol = "BINANCE:" + ticker + "USD";
    } else if (ticker.endsWith(".MIL")) {
        formattedSymbol = "MILAN:" + ticker.replace(".MIL", "");
    } else {
        formattedSymbol = "NASDAQ:" + ticker;
    }

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    
    // URL UNIVERSALE STANDALONE: Non viene bloccato dalle policy dei file locali del browser
    iframe.src = "https://tradingview.com" + formattedSymbol + "&interval=D&theme=dark&style=1&timezone=Exchange&locale=it";
    container.appendChild(iframe);
}

function renderSingleProfile(dataset, container, pocId, vaId, ticker, currentPrice) {
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

        rowElement.innerHTML = '<div class="price-label">' + priceLabelText + '</div>' +
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
    if (vaDisplayEl) vaDisplayEl.innerText = "" + valPrice.toFixed(2) + " - " + vahPrice.toFixed(2);
}
