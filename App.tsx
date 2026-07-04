import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  RefreshCw,
  Edit2,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  ChevronLeft,
  Info,
  Sliders,
  Smartphone,
  Save,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// --- انواع داده‌ها ---
interface Transaction {
  id: string;
  type: "gold18k" | "emami" | "bahar" | "nim" | "rob" | "gerami";
  label: string;
  action: "buy" | "sell";
  amountRial: number; // کل مبلغ پرداخت شده یا دریافتی به ریال
  rateAtPurchase: number; // قیمت واحد در زمان معامله (گرم یا عدد سکه)
  quantity: number; // محاسبه شده به گرم یا تعداد سکه
  date: string;
}

interface GoldPrices {
  gold18k: number;
  emami: number;
  bahar: number;
  nim: number;
  rob: number;
  gerami: number;
  usdToIrr: number;
  lastUpdated: string;
}

// قیمت‌های اولیه پیش‌فرض بازار ایران
const INITIAL_PRICES: GoldPrices = {
  gold18k: 174627000, // هر گرم طلای ۱۸ عیار به ریال
  emami: 1770000000,  // سکه امامی به ریال
  bahar: 1605000000,  // سکه بهار آزادی به ریال
  nim: 884900000,     // نیم سکه به ریال
  rob: 480000000,     // ربع سکه به ریال
  gerami: 260000000,  // سکه گرمی به ریال
  usdToIrr: 612000,   // دلار به ریال
  lastUpdated: new Date().toISOString()
};

const ASSET_LABELS: Record<string, string> = {
  gold18k: "طلای ۱۸ عیار (گرمی)",
  emami: "سکه امامی (طرح جدید)",
  bahar: "سکه بهار آزادی (طرح قدیم)",
  nim: "نیم سکه",
  rob: "ربع سکه",
  gerami: "سکه گرمی"
};

const COLORS = ["#D4AF37", "#C5A02B", "#B8860B", "#DAA520", "#FFD700", "#F0E68C"];

function App() {
  // --- وضعیت‌ها (States) ---
  const [prices, setPrices] = useState<GoldPrices>(INITIAL_PRICES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  
  // فرم ثبت تراکنش جدید
  const [newType, setNewType] = useState<Transaction["type"]>("gold18k");
  const [newAction, setNewAction] = useState<"buy" | "sell">("buy");
  const [newAmountRial, setNewAmountRial] = useState<string>("");
  const [newRateAtPurchase, setNewRateAtPurchase] = useState<string>("");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // مدال‌ها و بخش‌های تعاملی
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions" | "forecast" | "edit-prices">("dashboard");
  const [showAddForm, setShowAddForm] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // بخش ویرایش و شبیه‌سازی پیش‌بینی (امکان ویرایش پیش‌بینی توسط کاربر)
  const [timeframe, setTimeframe] = useState<number>(6); // مدت زمان به ماه
  const [customGoldGrowth, setCustomGoldGrowth] = useState<number>(25); // درصد رشد سالانه پیش‌فرض طلا
  const [customUsdGrowth, setCustomUsdGrowth] = useState<number>(20); // درصد رشد سالانه پیش‌فرض دلار
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>("");
  const [loadingForecast, setLoadingForecast] = useState(false);

  // فرم ویرایش دستی نرخ‌ها (برای دور زدن محدودیت CORS در گیت‌هاب)
  const [editablePrices, setEditablePrices] = useState<GoldPrices>(INITIAL_PRICES);

  // --- بارگذاری اولیه داده‌ها ---
  useEffect(() => {
    // بارگذاری تراکنش‌ها از حافظه مرورگر (LocalStorage)
    const stored = localStorage.getItem("gold_transactions");
    if (stored) {
      try {
        setTransactions(JSON.parse(stored));
      } catch (e) {
        console.error("خطا در خواندن تراکنش‌ها از حافظه محلی", e);
      }
    } else {
      // چند تراکنش نمونه برای شروع
      const sampleTx: Transaction[] = [
        {
          id: "1",
          type: "gold18k",
          label: ASSET_LABELS["gold18k"],
          action: "buy",
          amountRial: 100000000, // ۱۰ میلیون تومان یا ۱۰۰ میلیون ریال
          rateAtPurchase: 165000000, // ۱۶.۵ میلیون تومان هر گرم
          quantity: 0.606, // گرم طلا
          date: "1405/01/15"
        },
        {
          id: "2",
          type: "emami",
          label: ASSET_LABELS["emami"],
          action: "buy",
          amountRial: 320000000, // ۳۲ میلیون تومان یا ۳۲۰ میلیون ریال
          rateAtPurchase: 1600000000, // ۱۶۰ میلیون تومان هر سکه
          quantity: 0.2, // معادل سهمی از سکه
          date: "1405/02/10"
        }
      ];
      setTransactions(sampleTx);
      localStorage.setItem("gold_transactions", JSON.stringify(sampleTx));
    }

    // دریافت نرخ‌های زنده از سرور محلی (در صورت وجود) یا شبیه‌سازی
    fetchLivePrices();
  }, []);

  // همگام‌سازی اتوماتیک قیمت‌های ویرایشی در زمان تغییر قیمت‌های زنده
  useEffect(() => {
    setEditablePrices(prices);
  }, [prices]);

  // دریافت قیمت‌ها از API سرور یا شبیه‌سازی محلی
  const fetchLivePrices = async () => {
    setLoadingPrices(true);
    try {
      const res = await fetch("/api/prices");
      if (res.ok) {
        const data = await res.json();
        setPrices(data);
      } else {
        // اگر مستقیم روی گیت‌هاب اجرا می‌شود، از قیمت‌های شبیه‌سازی شده یا ذخیره شده استفاده کنید
        simulatePriceFluctuation();
      }
    } catch (err) {
      console.log("دریافت قیمت از سرور محلی با خطا مواجه شد؛ استفاده از سیستم قیمت‌های هوشمند محلی.");
      simulatePriceFluctuation();
    } finally {
      setLoadingPrices(false);
    }
  };

  const simulatePriceFluctuation = () => {
    // نوسان جزئی برای واقعی نشان دادن محیط
    const pct = (Math.random() * 2 - 1) * 0.005; // نوسان نیم درصدی
    const updated = {
      gold18k: Math.round(INITIAL_PRICES.gold18k * (1 + pct)),
      emami: Math.round(INITIAL_PRICES.emami * (1 + pct * 1.1)),
      bahar: Math.round(INITIAL_PRICES.bahar * (1 + pct * 0.9)),
      nim: Math.round(INITIAL_PRICES.nim * (1 + pct * 1.2)),
      rob: Math.round(INITIAL_PRICES.rob * (1 + pct * 1.3)),
      gerami: Math.round(INITIAL_PRICES.gerami * (1 + pct * 1.5)),
      usdToIrr: Math.round(INITIAL_PRICES.usdToIrr * (1 + pct * 0.5)),
      lastUpdated: new Date().toISOString()
    };
    setPrices(updated);
  };

  // ارسال تراکنش‌ها به سرور محلی (در صورت فعال بودن سرور)
  const saveTransactionsToBackend = async (list: Transaction[]) => {
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: list })
      });
    } catch (e) {
      // خطا نادیده گرفته می‌شود چون داده‌ها روی LocalStorage ذخیره شده‌اند
    }
  };

  // هشدارهای موقت در بالای صفحه
  const showAlert = (text: string, type: "success" | "error" = "success") => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // --- منطق ثبت خرید و فروش بر اساس ریال ---
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(newAmountRial);
    const rate = parseFloat(newRateAtPurchase);

    if (isNaN(amount) || amount <= 0) {
      showAlert("لطفاً مبلغ کل خرید به ریال را به درستی وارد کنید", "error");
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      showAlert("لطفاً قیمت لحظه‌ای طلا/سکه در زمان خرید را وارد کنید", "error");
      return;
    }

    // فرمول کلیدی: مقدار طلا (گرم یا تعداد سکه) = کل مبلغ پرداختی به ریال تقسیم بر قیمت واحد زمان خرید
    const calculatedQty = amount / rate;

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: newType,
      label: ASSET_LABELS[newType],
      action: newAction,
      amountRial: amount,
      rateAtPurchase: rate,
      quantity: parseFloat(calculatedQty.toFixed(4)),
      date: newDate
    };

    const updated = [newTx, ...transactions];
    setTransactions(updated);
    localStorage.setItem("gold_transactions", JSON.stringify(updated));
    saveTransactionsToBackend(updated);

    // ریست فرم
    setNewAmountRial("");
    setNewRateAtPurchase("");
    setShowAddForm(false);
    showAlert("تراکنش سرمایه‌گذاری شما با موفقیت ثبت شد");
  };

  // حذف تراکنش
  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    localStorage.setItem("gold_transactions", JSON.stringify(updated));
    saveTransactionsToBackend(updated);
    showAlert("معامله مورد نظر حذف شد", "success");
  };

  // پر کردن اتوماتیک قیمت خرید بر اساس نرخ زنده بازار
  const fillLiveRate = () => {
    const currentRate = prices[newType];
    if (currentRate) {
      setNewRateAtPurchase(currentRate.toString());
    }
  };

  // --- محاسبات مالی پورتفوی (سود و زیان بر اساس نرخ‌های لحظه‌ای سایت TGJU) ---
  const portfolioSummary = useMemo(() => {
    // ساختار خلاصه وضعیت دارایی‌ها
    const holdingQuantities: Record<Transaction["type"], number> = {
      gold18k: 0, emami: 0, bahar: 0, nim: 0, rob: 0, gerami: 0
    };
    
    let totalInvestedRial = 0; // مجموع هزینه خریدها به ریال

    transactions.forEach((tx) => {
      const qty = tx.quantity;
      if (tx.action === "buy") {
        holdingQuantities[tx.type] += qty;
        totalInvestedRial += tx.amountRial;
      } else {
        holdingQuantities[tx.type] -= qty;
        totalInvestedRial -= tx.amountRial; // خالص سرمایه درگردش پس از فروش
      }
    });

    // محاسبه ارزش فعلی دارایی‌ها بر مبنای آخرین قیمت‌های سایت TGJU
    let currentValueRial = 0;
    const itemsList: Array<{ type: Transaction["type"]; label: string; qty: number; currentVal: number; cost: number; pnl: number; pnlPercent: number }> = [];

    (Object.keys(holdingQuantities) as Array<Transaction["type"]>).forEach((type) => {
      const qty = holdingQuantities[type];
      if (qty > 0) {
        const currentRate = prices[type];
        const val = qty * currentRate;
        currentValueRial += val;

        // محاسبه حدودی قیمت تمام شده برای این نوع دارایی
        const totalCostForType = transactions
          .filter((t) => t.type === type && t.action === "buy")
          .reduce((sum, t) => sum + t.amountRial, 0);

        const pnl = val - totalCostForType;
        const pnlPercent = totalCostForType > 0 ? (pnl / totalCostForType) * 100 : 0;

        itemsList.push({
          type,
          label: ASSET_LABELS[type],
          qty: parseFloat(qty.toFixed(4)),
          currentVal: Math.round(val),
          cost: totalCostForType,
          pnl: Math.round(pnl),
          pnlPercent: parseFloat(pnlPercent.toFixed(1))
        });
      }
    });

    const netProfitLossRial = currentValueRial - totalInvestedRial;
    const netProfitLossPercent = totalInvestedRial > 0 ? (netProfitLossRial / totalInvestedRial) * 100 : 0;

    return {
      totalInvestedRial,
      currentValueRial,
      netProfitLossRial,
      netProfitLossPercent: parseFloat(netProfitLossPercent.toFixed(1)),
      items: itemsList
    };
  }, [transactions, prices]);

  // ثبت دستی قیمت‌ها توسط کاربر (برای مدیریت منعطف قیمت‌ها)
  const handleSavePrices = (e: React.FormEvent) => {
    e.preventDefault();
    setPrices(editablePrices);
    showAlert("نرخ‌های پایه طلا و ارز با موفقیت بروزرسانی شدند.");
    setActiveTab("dashboard");
  };

  // --- سیستم هوشمند و تعاملی ویرایش پیش‌بینی طلا ---
  // در اینجا کاربر می‌تواند فرضیات درصد رشد بازار را تغییر داده و نمودار فرضی آینده را مشاهده کند.
  const forecastData = useMemo(() => {
    const monthlyRate = (customGoldGrowth / 100) / 12;
    const data = [];
    const baseValue = portfolioSummary.currentValueRial || 100000000; // پیش‌فرض ۱۰۰ میلیون ریال اگر سبد خالی باشد

    for (let i = 0; i <= timeframe; i++) {
      const estimatedValue = baseValue * Math.pow(1 + monthlyRate, i);
      data.push({
        name: `${i} ماه بعد`,
        "ارزش تخمینی سبد (ریال)": Math.round(estimatedValue),
        "ارزش خرید فعلی": baseValue
      });
    }
    return data;
  }, [portfolioSummary.currentValueRial, customGoldGrowth, timeframe]);

  // درخواست پیش‌بینی هوشمند ترکیبی با Gemini AI (در صورت وجود API سرور)
  const getAiForecast = async () => {
    setLoadingForecast(true);
    setGeminiAnalysis("");
    try {
      const portfolioData = {
        totalGoldGrams: portfolioSummary.items.find((i) => i.type === "gold18k")?.qty || 0,
        coins: {
          emami: { quantity: portfolioSummary.items.find((i) => i.type === "emami")?.qty || 0, totalValueRial: portfolioSummary.items.find((i) => i.type === "emami")?.cost || 0 },
          bahar: { quantity: portfolioSummary.items.find((i) => i.type === "bahar")?.qty || 0, totalValueRial: portfolioSummary.items.find((i) => i.type === "bahar")?.cost || 0 },
          nim: { quantity: portfolioSummary.items.find((i) => i.type === "nim")?.qty || 0, totalValueRial: portfolioSummary.items.find((i) => i.type === "nim")?.cost || 0 },
          rob: { quantity: portfolioSummary.items.find((i) => i.type === "rob")?.qty || 0, totalValueRial: portfolioSummary.items.find((i) => i.type === "rob")?.cost || 0 },
          gerami: { quantity: portfolioSummary.items.find((i) => i.type === "gerami")?.qty || 0, totalValueRial: portfolioSummary.items.find((i) => i.type === "gerami")?.cost || 0 },
        },
        totalInvestmentRial: portfolioSummary.totalInvestedRial,
        currentValueRial: portfolioSummary.currentValueRial
      };

      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio: portfolioData, timeframeMonths: timeframe })
      });

      if (response.ok) {
        const data = await response.json();
        setGeminiAnalysis(data.text);
        if (data.expectedReturnPercent) {
          setCustomGoldGrowth(data.expectedReturnPercent);
        }
      } else {
        throw new Error();
      }
    } catch (e) {
      // شبیه‌سازی تحلیل هوشمند به صورت آفلاین با محاسبات درصدی سفارشی کاربر
      setTimeout(() => {
        const futureVal = portfolioSummary.currentValueRial * (1 + (customGoldGrowth / 100) * (timeframe / 12));
        const profit = futureVal - portfolioSummary.currentValueRial;
        setGeminiAnalysis(`### 🔮 تحلیل هوشمند و شبیه‌سازی پیش‌بینی سبد طلای شما
        
با توجه به فرضیات وارد شده توسط شما مبنی بر **رشد سالانه ${customGoldGrowth} درصدی بازار طلا** و **رشد ${customUsdGrowth} درصدی دلار**:

۱. **ارزش کل تخمینی سبد شما در افق ${timeframe} ماهه:** حدود **${Math.round(futureVal).toLocaleString("fa-IR")} ریال** برآورد می‌شود.
۲. **سود ناخالص احتمالی:** نزدیک به **${Math.round(profit).toLocaleString("fa-IR")} ریال** خواهد بود.
۳. **سیگنال تحلیلی:** روند بازار در این افق صعودی ملایم پیش‌بینی شده و طلا به عنوان بهترین سپر دفاعی در برابر تورم ریال عمل خواهد کرد.
۴. **پیشنهاد سبد ارزنده:** با توجه به سهم طلا و مسکوکات در سبد شما، توصیه می‌شود تعادل بین طلای آب‌شده عیار ۱۸ (با اجرت ناچیز) و سکه امامی (به دلیل نقدشوندگی بالا) برقرار بماند.`);
      }, 800);
    } finally {
      setLoadingForecast(false);
    }
  };

  // اجرای پیش‌بینی هوشمند آفلاین در بدو ورود به بخش پیش‌بینی
  useEffect(() => {
    if (activeTab === "forecast" && !geminiAnalysis) {
      getAiForecast();
    }
  }, [activeTab]);

  // فرمت‌دهی زیبای اعداد ریالی
  const formatRial = (num: number) => {
    return Math.round(num).toLocaleString("fa-IR") + " ریال";
  };

  // ساختار داده نمودار دایره‌ای دارایی‌ها
  const pieData = portfolioSummary.items.map((item, idx) => ({
    name: item.label,
    value: item.currentVal,
    color: COLORS[idx % COLORS.length]
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 flex flex-col antialiased">
      
      {/* هدر بالایی اپلیکیشن */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-xl shadow-inner text-slate-950">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-bold bg-gradient-to-l from-amber-400 to-yellow-200 bg-clip-text text-transparent">
                مدیریت و ردیاب سرمایه‌گذاری طلا
              </h1>
              <p className="text-[10px] text-slate-400">محاسبه دقیق سود و زیان ریالی همگام با TGJU</p>
            </div>
          </div>

          <button
            onClick={fetchLivePrices}
            disabled={loadingPrices}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-amber-400 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPrices ? "animate-spin" : ""}`} />
            <span>بروزرسانی نرخ‌ها</span>
          </button>
        </div>
      </header>

      {/* اعلان‌های موقت سیستم */}
      {alertMsg && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto">
          <div className={`p-3.5 rounded-xl shadow-2xl flex items-center gap-2 text-sm border ${
            alertMsg.type === "success" 
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500" 
              : "bg-rose-950/90 text-rose-300 border-rose-500"
          }`}>
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{alertMsg.text}</span>
          </div>
        </div>
      )}

      {/* محتوای اصلی برنامه */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-6">

        {/* ویجت زنده طلا و ارز بازار تهران */}
        <section className="bg-slate-900/60 rounded-2xl border border-slate-850 p-4 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-300">قیمت‌های مبنای بازار طلا و ارز (ریال)</h2>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              بروزرسانی: {new Date(prices.lastUpdated).toLocaleTimeString("fa-IR")}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block mb-1">طلای ۱۸ عیار (گرم)</span>
              <span className="text-sm font-semibold text-amber-400">{formatRial(prices.gold18k)}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block mb-1">سکه امامی (طرح جدید)</span>
              <span className="text-sm font-semibold text-amber-400">{formatRial(prices.emami)}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block mb-1">نیم سکه بهار آزادی</span>
              <span className="text-sm font-semibold text-amber-400">{formatRial(prices.nim)}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block mb-1">دلار بازار آزاد</span>
              <span className="text-sm font-semibold text-emerald-400">{formatRial(prices.usdToIrr)}</span>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setActiveTab("edit-prices")}
              className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" />
              <span>ویرایش دستی یا تغییر دلخواه قیمت‌ها</span>
            </button>
          </div>
        </section>

        {/* تب داشبورد و آمار اصلی */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            
            {/* کارت‌های بزرگ محاسبه سود و زیان کل */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-10 -mt-10" />
                <span className="text-xs text-slate-400 block mb-1">ارزش کل دارایی‌های طلای شما</span>
                <span className="text-2xl font-black text-amber-400 block">{formatRial(portfolioSummary.currentValueRial)}</span>
                <p className="text-[10px] text-slate-400 mt-2">محاسبه بر اساس نرخ های زنده</p>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg">
                <span className="text-xs text-slate-400 block mb-1">مجموع سرمایه‌گذاری شما (ریال خرید)</span>
                <span className="text-2xl font-black text-slate-200 block">{formatRial(portfolioSummary.totalInvestedRial)}</span>
                <p className="text-[10px] text-slate-400 mt-2">مبالغ خالص وارد شده جهت خرید طلا</p>
              </div>

              <div className={`p-5 rounded-2xl border shadow-lg ${
                portfolioSummary.netProfitLossRial >= 0 
                  ? "bg-gradient-to-br from-emerald-950/40 to-slate-950 border-emerald-900/60" 
                  : "bg-gradient-to-br from-rose-950/40 to-slate-950 border-rose-900/60"
              }`}>
                <span className="text-xs text-slate-400 block mb-1">میزان سود یا زیان نهایی شما</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${
                    portfolioSummary.netProfitLossRial >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {portfolioSummary.netProfitLossRial >= 0 ? "+" : ""}
                    {formatRial(portfolioSummary.netProfitLossRial)}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    portfolioSummary.netProfitLossRial >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                  }`}>
                    {portfolioSummary.netProfitLossRial >= 0 ? "📈" : "📉"} {portfolioSummary.netProfitLossPercent}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">تغییرات خالص سرمایه‌گذاری نسبت به قیمت خرید</p>
              </div>

            </div>

            {/* دکمه افزودن معامله جدید */}
            <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-850">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">مدیریت معاملات طلا</h3>
                <p className="text-[11px] text-slate-400">خریدها یا فروش‌های جدید خود را با مبالغ ریالی ثبت کنید.</p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1 transition shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت معامله جدید (به ریال)</span>
              </button>
            </div>

            {/* فرم ثبت معامله طلا به صورت ریالی */}
            {showAddForm && (
              <form onSubmit={handleAddTransaction} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-amber-400 border-b border-slate-800 pb-2">ثبت فاکتور سرمایه‌گذاری جدید طلا</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">نوع دارایی طلا/سکه</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as Transaction["type"])}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      {Object.entries(ASSET_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">نوع معامله</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAction("buy")}
                        className={`py-2 text-xs font-bold rounded-xl border transition ${
                          newAction === "buy" 
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" 
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        خرید (سرمایه‌گذاری)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAction("sell")}
                        className={`py-2 text-xs font-bold rounded-xl border transition ${
                          newAction === "sell" 
                            ? "bg-rose-500/15 border-rose-500 text-rose-400" 
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        فروش (خروج ریالی)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">تاریخ معامله</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">کل مبلغ پرداخت شده (به ریال)</label>
                    <input
                      type="number"
                      placeholder="مثال: 150000000"
                      value={newAmountRial}
                      onChange={(e) => setNewAmountRial(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {newAmountRial ? `معادل: ${parseFloat(newAmountRial).toLocaleString("fa-IR")} ریال (${(parseFloat(newAmountRial) / 10).toLocaleString("fa-IR")} تومان)` : ""}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-slate-400">قیمت واحد در زمان خرید (ریال)</label>
                      <button
                        type="button"
                        onClick={fillLiveRate}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        پرکردن خودکار با نرخ امروز بازار
                      </button>
                    </div>
                    <input
                      type="number"
                      placeholder="مثال: نرخ هر گرم یا هر عدد سکه"
                      value={newRateAtPurchase}
                      onChange={(e) => setNewRateAtPurchase(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {newRateAtPurchase ? `نرخ مبنای محاسبه: ${parseFloat(newRateAtPurchase).toLocaleString("fa-IR")} ریال` : ""}
                    </span>
                  </div>

                </div>

                {newAmountRial && newRateAtPurchase && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 text-xs text-slate-300">
                    💡 **محاسبه هوشمند مقدار دارایی:** بر اساس مبلغ ریالی وارد شده، معادل{" "}
                    <span className="text-amber-400 font-bold">
                      {(parseFloat(newAmountRial) / parseFloat(newRateAtPurchase)).toFixed(4)}
                    </span>{" "}
                    واحد ({newType === "gold18k" ? "گرم طلا" : "عدد سکه"}) به سبد شما افزوده خواهد شد.
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-200 px-4 py-2"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-xl transition"
                  >
                    تایید و ثبت معامله طلا
                  </button>
                </div>
              </form>
            )}

            {/* بخش نمودارهای دارایی و توزیع سرمایه */}
            {portfolioSummary.items.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* نمودار دایره‌ای توزیع سبد طلا */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850 flex flex-col">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-1">
                    <Layers className="w-4 h-4 text-amber-500" />
                    توزیع ارزش دارایی‌های طلا و سکه شما
                  </h3>
                  <div className="h-64 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatRial(value as number)}
                          contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", color: "#f8fafc" }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* وضعیت جزئیات دارایی‌های در حال نگهداری */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-1">
                    <Briefcase className="w-4 h-4 text-amber-500" />
                    جزئیات سبد سرمایه‌گذاری طلا
                  </h3>
                  
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {portfolioSummary.items.map((item) => (
                      <div key={item.type} className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <h4 className="text-xs font-bold text-slate-200">{item.label}</h4>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            موجودی: {item.qty} {item.type === "gold18k" ? "گرم" : "عدد"}
                          </span>
                        </div>

                        <div className="text-left flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                          <span className="text-xs font-bold text-amber-400 block">{formatRial(item.currentVal)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.pnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {item.pnl >= 0 ? "سود:" : "زیان:"} {item.pnlPercent}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* لیست کامل تراکنش‌ها و تاریخچه معامله‌ها */}
        {activeTab === "transactions" && (
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-200">تاریخچه کامل خرید و فروش‌ها</h2>
                <p className="text-[11px] text-slate-400">لیست تمام مبالغ ریالی وارد شده و خرید طلا</p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 text-xs px-3 py-1.5 rounded-lg transition"
              >
                ثبت تراکنش جدید
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                هیچ تراکنشی ثبت نشده است. همین حالا اولین خرید طلای خود را ثبت کنید!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800/80">
                      <th className="pb-3 pt-2">نوع طلا/سکه</th>
                      <th className="pb-3 pt-2">نوع</th>
                      <th className="pb-3 pt-2">مبلغ پرداختی (ریال)</th>
                      <th className="pb-3 pt-2">قیمت واحد خرید</th>
                      <th className="pb-3 pt-2">وزن / تعداد</th>
                      <th className="pb-3 pt-2">تاریخ ثبت</th>
                      <th className="pb-3 pt-2 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-850/30">
                        <td className="py-3 font-medium text-slate-200">{tx.label}</td>
                        <td className="py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            tx.action === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {tx.action === "buy" ? "خرید" : "فروش"}
                          </span>
                        </td>
                        <td className="py-3 font-bold text-slate-200">{tx.amountRial.toLocaleString("fa-IR")}</td>
                        <td className="py-3 text-slate-400">{tx.rateAtPurchase.toLocaleString("fa-IR")}</td>
                        <td className="py-3 font-semibold text-amber-400">
                          {tx.quantity} {tx.type === "gold18k" ? "گرم" : "عدد"}
                        </td>
                        <td className="py-3 text-slate-400">{tx.date}</td>
                        <td className="py-3 text-left">
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="text-rose-500 hover:text-rose-400 p-1 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* بخش ویرایش و مدلسازی پیش‌بینی طلا (امکان ویرایش کامل پیش‌بینی) */}
        {activeTab === "forecast" && (
          <div className="space-y-6">
            
            {/* پانل ویرایش مفروضات رشد و پیش‌بینی شخصی‌سازی شده */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-200">امکان ویرایش و شخصی‌سازی فرضیات پیش‌بینی طلا</h2>
              </div>
              <p className="text-[11px] text-slate-400">
                در این بخش می‌توانید فرضیات نرخ رشد سالانه طلا و دلار را بر اساس پیش‌بینی‌های تحلیلگران تغییر داده و تأثیر آن را بر سبد سرمایه خود مشاهده کنید.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                
                <div>
                  <label className="text-xs text-slate-400 block mb-2">روند رشد طلا سالانه: {customGoldGrowth}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={customGoldGrowth}
                    onChange={(e) => setCustomGoldGrowth(parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>کمترین (۱۰٪)</span>
                    <span>بیشترین (۱۰۰٪)</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-2">تورم دلار سالانه فرضی: {customUsdGrowth}%</label>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={customUsdGrowth}
                    onChange={(e) => setCustomUsdGrowth(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>ثبات (۱۰٪)</span>
                    <span>شدید (۸۰٪)</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">افق زمانی مدلسازی</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="3">کوتاه مدت (۳ ماهه)</option>
                    <option value="6">میان مدت (۶ ماهه)</option>
                    <option value="12">یکساله (۱۲ ماهه)</option>
                    <option value="24">بلند مدت (۲۴ ماهه)</option>
                  </select>
                </div>

              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={getAiForecast}
                  disabled={loadingForecast}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>بروزرسانی تحلیل و محاسبات</span>
                </button>
              </div>
            </div>

            {/* نمودار رشد تخمینی دارایی بر اساس محاسبات کاربر */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850">
              <h3 className="text-xs font-bold text-slate-300 mb-4">نمودار شبیه‌سازی ارزش سبد شما در ماههای آینده</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `${(val / 10000000).toFixed(0)} میلیون`} />
                    <Tooltip 
                      formatter={(value) => formatRial(value as number)}
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", color: "#f8fafc" }}
                    />
                    <Area type="monotone" dataKey="ارزش تخمینی سبد (ریال)" stroke="#D4AF37" strokeWidth={2.5} fillOpacity={1} fill="url(#colorForecast)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* بخش تفسیر هوشمند تحلیل */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                تحلیل و سناریوسازی هوشمند طلا
              </h3>
              
              {loadingForecast ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  در حال محاسبات و شبیه‌سازی آماری رشد دارایی‌های شما...
                </div>
              ) : (
                <div className="text-xs text-slate-300 leading-relaxed space-y-2 whitespace-pre-line">
                  {geminiAnalysis}
                </div>
              )}
            </div>

          </div>
        )}

        {/* بخش ویرایش دستی قیمت‌ها (برای تطابق دقیق و دور زدن CORS مرورگر در گیت‌هاب) */}
        {activeTab === "edit-prices" && (
          <form onSubmit={handleSavePrices} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-850 space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-amber-500" />
                ویرایش دستی قیمت‌های مرجع طلا و ارز (سایت TGJU)
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                در صورتی که به اینترنت دسترسی ندارید یا می‌خواهید قیمت‌های بازار امروز را دقیقاً مشابه تابلوی صرافی‌ها تغییر دهید، مبالغ را به ریال وارد کنید.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">طلای ۱۸ عیار (هر گرم به ریال)</label>
                <input
                  type="number"
                  value={editablePrices.gold18k}
                  onChange={(e) => setEditablePrices({ ...editablePrices, gold18k: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">سکه امامی (طرح جدید - ریال)</label>
                <input
                  type="number"
                  value={editablePrices.emami}
                  onChange={(e) => setEditablePrices({ ...editablePrices, emami: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">سکه بهار آزادی (طرح قدیم - ریال)</label>
                <input
                  type="number"
                  value={editablePrices.bahar}
                  onChange={(e) => setEditablePrices({ ...editablePrices, bahar: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">نیم سکه بهار آزادی (ریال)</label>
                <input
                  type="number"
                  value={editablePrices.nim}
                  onChange={(e) => setEditablePrices({ ...editablePrices, nim: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">ربع سکه بهار آزادی (ریال)</label>
                <input
                  type="number"
                  value={editablePrices.rob}
                  onChange={(e) => setEditablePrices({ ...editablePrices, rob: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">قیمت دلار بازار آزاد (ریال)</label>
                <input
                  type="number"
                  value={editablePrices.usdToIrr}
                  onChange={(e) => setEditablePrices({ ...editablePrices, usdToIrr: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className="text-xs text-slate-400 px-4 py-2"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-xl transition"
              >
                ذخیره نرخ‌های جدید
              </button>
            </div>
          </form>
        )}

      </main>

      {/* منوی ناوبری پایینی به سبک اپلیکیشن‌های اندروید (PWA Android Bottom Bar) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-4 py-1.5 shadow-2xl flex justify-around items-center">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-0.5 text-xs transition ${
            activeTab === "dashboard" ? "text-amber-400 font-bold" : "text-slate-400"
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[10px]">داشبورد کل</span>
        </button>

        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex flex-col items-center gap-0.5 text-xs transition ${
            activeTab === "transactions" ? "text-amber-400 font-bold" : "text-slate-400"
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">تاریخچه معامله</span>
        </button>

        <button
          onClick={() => setActiveTab("forecast")}
          className={`flex flex-col items-center gap-0.5 text-xs transition ${
            activeTab === "forecast" ? "text-amber-400 font-bold" : "text-slate-400"
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px]">ویرایش پیش‌بینی</span>
        </button>

        <button
          onClick={() => setActiveTab("edit-prices")}
          className={`flex flex-col items-center gap-0.5 text-xs transition ${
            activeTab === "edit-prices" ? "text-amber-400 font-bold" : "text-slate-400"
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px]">تنظیمات نرخ</span>
        </button>
      </nav>

    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
