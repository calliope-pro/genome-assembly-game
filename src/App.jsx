import { useEffect, useRef, useState } from "react";
import {
  Shuffle,
  RotateCcw,
  CheckCircle,
  Eye,
  EyeOff,
  Lightbulb,
  StickyNote,
} from "lucide-react";

/**
 * GenomeAssemblyGame — 完全版（再現性あり、readごとにoverlapを保持、overlap内にエラー無し）
 *
 * 使い方：
 * - Seed 欄に数値を入れて「再現」で同じ問題が再現されます。
 * - それ以外は従来の UI と同様にドラッグで並べ替え、アセンブリを目指してください。
 */

const GenomeAssemblyGame = () => {
  const [level, setLevel] = useState(1);
  const [seedInput, setSeedInput] = useState("");
  const [seed, setSeed] = useState(null);
  const [targetSequence, setTargetSequence] = useState("");
  const [reads, setReads] = useState([]);
  const [selectedReads, setSelectedReads] = useState([]);
  const [assembledSequence, setAssembledSequence] = useState("");
  const [gameComplete, setGameComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [showTarget, setShowTarget] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [showOverlapHints, setShowOverlapHints] = useState(false);
  const [readMemos, setReadMemos] = useState({});
  const [showMemoInput, setShowMemoInput] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const lastSuccessRef = useRef(false);

  // ---------- seeded RNG (32-bit LCG) ----------
  const createSeededRandom = (s) => {
    let state = s >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  };

  // generate realistic DNA (avoid >3 repeats)
  const generateRealisticDNA = (length, random) => {
    const bases = ["A", "T", "G", "C"];
    const seq = [];
    for (let i = 0; i < length; i++) {
      let attempts = 0;
      while (true) {
        const b = bases[Math.floor(random() * 4)];
        const lastThree = seq.slice(-3);
        if (lastThree.length < 3) {
          seq.push(b);
          break;
        }
        if (!(lastThree[0] === b && lastThree[1] === b && lastThree[2] === b)) {
          seq.push(b);
          break;
        }
        attempts++;
        if (attempts > 1000) {
          seq.push(b);
          break;
        }
      }
    }
    return seq.join("");
  };

  // default seed generator (only used to create a seed if user didn't provide one)
  const getRandomSeed = () => {
    const cryptoObj = window.crypto || window.msCrypto;
    let extra = Math.floor(Math.random() * 1e6);
    if (cryptoObj && cryptoObj.getRandomValues) {
      const arr = new Uint32Array(1);
      cryptoObj.getRandomValues(arr);
      extra ^= arr[0];
    }
    return ((Date.now() & 0xffffffff) ^ extra ^ Math.floor(performance.now())) >>> 0;
  };

  // ---------- level config ----------
  const getLevelConfig = (lvl) => {
    const cfg = {
      1: {
        length: 50,
        numReads: 6,
        avgReadLength: 12,
        readLengthVariation: 0.2,
        errorReads: 0,
        reverseReads: 0,
        description: "基礎編：エラーなし、正鎖のみ、6reads",
        minOverlap: 3,
        maxOverlap: 8,
      },
      2: {
        length: 80,
        numReads: 6,
        avgReadLength: 18,
        readLengthVariation: 0.25,
        errorReads: 1,
        reverseReads: 1,
        description: "応用編：エラー1個、逆鎖1個、6reads",
        minOverlap: 4,
        maxOverlap: 12,
      },
      3: {
        length: 140,
        numReads: 6,
        avgReadLength: 30,
        readLengthVariation: 0.3,
        errorReads: 1,
        reverseReads: 2,
        description: "上級編：長い配列、エラー1個、逆鎖2個、6reads",
        minOverlap: 7,
        maxOverlap: 20,
      },
      4: {
        length: 1650,
        numReads: 20,
        avgReadLength: 100,
        readLengthVariation: 0.25,
        errorReads: 5,
        reverseReads: 5,
        description: "実践編：長い配列、エラー5個、逆鎖5個、20reads",
        minOverlap: 12,
        maxOverlap: 25,
      },
    };
    return cfg[lvl] || cfg[1];
  };

  // ---------- utility: reverse complement ----------
  const reverseComplement = (s) => {
    const comp = { A: "T", T: "A", G: "C", C: "G" };
    return s.split("").reverse().map((c) => comp[c] || c).join("");
  };

  // ---------- utility: avoid ambiguous overlaps ----------
  const checkAmbiguousOverlap = (sequence) => {
    if (!sequence || sequence.length < 3) return false;
    
    // Only reject if it's a single character repeated (like AAAA or GGG)
    const first = sequence[0];
    if (sequence.split("").every((c) => c === first)) return true;
    
    // For 2-character pattern repeats, only reject if pattern repeats 3+ times (6+ chars)
    if (sequence.length >= 6) {
      const patt = sequence.slice(0, 2);
      let isRepeating = true;
      for (let i = 0; i < sequence.length; i += 2) {
        if (sequence.slice(i, i + 2) !== patt) {
          isRepeating = false;
          break;
        }
      }
      if (isRepeating) return true;
    }
    
    return false;
  };

  // ---------- distribute a total into n parts with bounds (randomized, deterministic with rng) ----------
  const distributeSumToBounds = (n, total, minVal, maxVal, rng) => {
    if (n === 0) return [];
    if (n === 1) return [Math.max(minVal, Math.min(maxVal, total))];
    
    const out = [];
    let remaining = total;
    
    // Use a different approach: generate each value independently within constraints
    for (let i = 0; i < n; i++) {
      const slotsLeft = n - i;
      const minRemaining = (slotsLeft - 1) * minVal;
      const maxRemaining = (slotsLeft - 1) * maxVal;
      
      // Calculate bounds for current slot
      const lowerBound = Math.max(minVal, remaining - maxRemaining);
      const upperBound = Math.min(maxVal, remaining - minRemaining);
      
      let value;
      if (lowerBound >= upperBound) {
        value = lowerBound;
      } else {
        // Generate random value in valid range
        const range = upperBound - lowerBound;
        value = lowerBound + Math.floor(rng() * (range + 1));
      }
      
      out.push(value);
      remaining -= value;
    }
    
    return out;
  };

  // ---------- error insertion while protecting overlaps ----------
  const introduceErrorProtected = (forwardSeq, leftProtect, rightProtect, rng) => {
    const bases = ["A", "T", "G", "C"];
    const L = forwardSeq.length;
    const left = Math.max(0, Math.min(leftProtect, Math.floor(L / 2)));
    const right = Math.max(0, Math.min(rightProtect, Math.floor(L / 2)));
    const safeStart = left;
    const safeEnd = Math.max(safeStart + 1, L - right); // exclusive
    if (safeEnd <= safeStart) {
      const pos = Math.floor(L / 2);
      const orig = forwardSeq[pos];
      const cand = bases.filter((b) => b !== orig);
      const wrong = cand[Math.floor(rng() * cand.length)];
      return forwardSeq.substring(0, pos) + wrong + forwardSeq.substring(pos + 1);
    }
    const pos = safeStart + Math.floor(rng() * (safeEnd - safeStart));
    const orig = forwardSeq[pos];
    const cand = bases.filter((b) => b !== orig);
    const wrong = cand[Math.floor(rng() * cand.length)];
    return forwardSeq.substring(0, pos) + wrong + forwardSeq.substring(pos + 1);
  };

  // ---------- findBestOverlap: robust overlap detection ----------
  const findBestOverlap = (prevSeq, currSeq, declaredOverlap = null, minOverlap = 3, maxSearch = 500) => {
    if (!prevSeq || !currSeq) return 0;
    
    const limit = Math.min(maxSearch, prevSeq.length, currSeq.length);
    
    // First try declared overlap if provided and valid
    if (declaredOverlap && declaredOverlap >= minOverlap && declaredOverlap <= limit) {
      const suffix = prevSeq.slice(-declaredOverlap);
      const prefix = currSeq.slice(0, declaredOverlap);
      if (suffix === prefix) {
        // Only reject if it's truly ambiguous (single character repeats of 4+ chars)
        if (!checkAmbiguousOverlap(suffix)) {
          return declaredOverlap;
        }
      }
    }
    
    // Search for best overlap from longest to shortest
    let bestOverlap = 0;
    for (let k = limit; k >= minOverlap; k--) {
      const suffix = prevSeq.slice(-k);
      const prefix = currSeq.slice(0, k);
      if (suffix === prefix) {
        // Accept any matching overlap unless it's truly problematic
        if (!checkAmbiguousOverlap(suffix)) {
          bestOverlap = k;
          break;
        }
        // Even if ambiguous, keep track of it as potential fallback
        if (bestOverlap === 0) {
          bestOverlap = k;
        }
      }
    }
    
    return bestOverlap;
  };

  // ---------- generate reads from reference with reproducible overlap distribution ----------
  const generateReadsFromReference = (reference, config, providedSeed) => {
    const rng = createSeededRandom(providedSeed >>> 0);
    const {
      numReads,
      avgReadLength,
      readLengthVariation,
      errorReads,
      reverseReads,
      minOverlap,
      maxOverlap,
    } = config;

    // 1) determine read lengths deterministically
    const minReadLen = 10;
    const readLengths = [];
    for (let i = 0; i < numReads; i++) {
      const lengthVar = 1 + (rng() - 0.5) * 2 * readLengthVariation;
      readLengths.push(Math.max(minReadLen, Math.floor(avgReadLength * lengthVar)));
    }

    // 2) compute S_required = sum(L_i) - reference.length
    let sumL = readLengths.reduce((a, b) => a + b, 0);
    let S_required = sumL - reference.length;

    // If reads are too short (S_required < 0), extend last read to cover
    if (S_required < 0) {
      const extend = -S_required;
      readLengths[readLengths.length - 1] += extend;
      sumL += extend;
      S_required = 0;
    }
    
    // Ensure all read lengths are at least minReadLen
    for (let i = 0; i < readLengths.length; i++) {
      if (readLengths[i] < minReadLen) {
        const diff = minReadLen - readLengths[i];
        readLengths[i] = minReadLen;
        sumL += diff;
        S_required += diff;
      }
    }

    // 3) ensure S_required is within possible bounds of overlaps
    const slots = Math.max(0, numReads - 1);
    const minTotal = slots * minOverlap;
    const maxTotal = slots * maxOverlap;

    if (slots === 0) {
      // single read case
      const single = [
        {
          id: 0,
          forwardSeq: reference.substring(0, readLengths[0]),
          displaySeq: reference.substring(0, readLengths[0]),
          overlapWithPrev: 0,
          overlapWithNext: 0,
          isReverse: false,
          hasError: false,
          originalStart: 0,
          length: readLengths[0],
        },
      ];
      return single;
    }

    // If S_required lower than minTotal, we need to increase sumL (extend last read)
    if (S_required < minTotal) {
      const need = minTotal - S_required;
      readLengths[readLengths.length - 1] += need;
      sumL += need;
      S_required = sumL - reference.length;
      // if still negative (unlikely), force to zero
      if (S_required < 0) {
        readLengths[readLengths.length - 1] += -S_required;
        sumL += -S_required;
        S_required = 0;
      }
    }

    // If S_required greater than maxTotal, we need to reduce sumL (shrink some reads preserving minReadLen)
    if (S_required > maxTotal) {
      let excess = S_required - maxTotal;
      // reduce from the end backwards if possible
      for (let i = readLengths.length - 1; i >= 0 && excess > 0; i--) {
        const canReduce = Math.max(0, readLengths[i] - minReadLen);
        const take = Math.min(canReduce, excess);
        readLengths[i] -= take;
        excess -= take;
      }
      sumL = readLengths.reduce((a, b) => a + b, 0);
      S_required = Math.max(0, sumL - reference.length);
      // If still > maxTotal (cannot shrink enough), clamp S_required to maxTotal and we'll handle later by distributing max overlaps
    }

    // recompute sumL and S_required now
    sumL = readLengths.reduce((a, b) => a + b, 0);
    S_required = sumL - reference.length;
    if (S_required < 0) {
      // extend last read as final fallback
      readLengths[readLengths.length - 1] += -S_required;
      sumL = readLengths.reduce((a, b) => a + b, 0);
      S_required = 0;
    }

    // clamp desired total overlap to feasible [minTotal, maxTotal]
    const desiredOverlapTotal = Math.min(maxTotal, Math.max(minTotal, S_required));

    // distribute desiredOverlapTotal into slots with bounds [minOverlap, maxOverlap]
    const overlaps = distributeSumToBounds(slots, desiredOverlapTotal, minOverlap, maxOverlap, rng);

    // compute start positions from read lengths and overlaps
    const starts = [];
    starts[0] = 0;
    for (let i = 1; i < numReads; i++) {
      const prevStart = starts[i - 1];
      const prevLen = readLengths[i - 1];
      const overlapWithPrev = overlaps[i - 1]; // this is the overlap between read i-1 and read i
      starts[i] = prevStart + prevLen - overlapWithPrev;
    }

    // if last read goes beyond reference, extend last read length
    const lastIndex = numReads - 1;
    const lastEnd = starts[lastIndex] + readLengths[lastIndex];
    if (lastEnd < reference.length) {
      // extend last read to cover remaining tail
      const extend = reference.length - lastEnd;
      readLengths[lastIndex] += extend;
    } else if (lastEnd > reference.length) {
      // shrink last read if it exceeds (but maintain minReadLen)
      const overflow = lastEnd - reference.length;
      const canShrink = Math.max(0, readLengths[lastIndex] - minReadLen);
      const shrink = Math.min(canShrink, overflow);
      readLengths[lastIndex] -= shrink;
      // if still too long (rare), just allow last read to be trimmed when generating forwardSeq
    }

    // now build reads array
    const readObjs = [];
    for (let i = 0; i < numReads; i++) {
      const originalStart = starts[i]; // keep original calculated start
      let s = starts[i];
      
      // If start position is beyond reference, adjust it
      if (s >= reference.length) {
        s = Math.max(0, reference.length - readLengths[i]);
      }
      s = Math.max(0, Math.min(s, reference.length - 1)); // ensure start is within bounds
      
      const maxLen = reference.length - s;
      let len = Math.min(readLengths[i], maxLen);
      len = Math.max(minReadLen, len); // ensure minimum length
      
      const end = Math.min(s + len, reference.length);
      const forwardSeq = reference.substring(s, end);
      readObjs.push({
        id: i,
        forwardSeq,
        displaySeq: forwardSeq, // may be replaced if reversed later
        overlapWithPrev: i === 0 ? 0 : overlaps[i - 1], // overlap with previous read
        overlapWithNext: i === numReads - 1 ? 0 : overlaps[i], // overlap with next read
        isReverse: false,
        hasError: false,
        originalStart: originalStart, // use original calculated start position
        actualStart: s, // actual start position used for extraction
        length: forwardSeq.length,
      });
    }

    // ---------- inject errors (choose indices deterministically) ----------
    // shuffle indices deterministically
    const idxs = [...Array(numReads).keys()];
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    const errCnt = Math.min(errorReads, numReads);
    const errIndices = idxs.slice(0, errCnt);
    for (const idx of errIndices) {
      const r = readObjs[idx];
      const leftProtect = r.overlapWithPrev ?? 0;
      const rightProtect = r.overlapWithNext ?? 0;
      r.forwardSeq = introduceErrorProtected(r.forwardSeq, leftProtect, rightProtect, rng);
      r.hasError = true;
      r.displaySeq = r.isReverse ? reverseComplement(r.forwardSeq) : r.forwardSeq;
      r.length = r.forwardSeq.length;
    }

    // ---------- choose reverse reads (deterministic, avoid flipping overlap semantics) ----------
    const remIdx = idxs.slice(errCnt);
    const revCnt = Math.min(reverseReads, numReads);
    const revIndices = remIdx.slice(0, revCnt);
    for (const idx of revIndices) {
      const r = readObjs[idx];
      r.isReverse = true;
      r.displaySeq = reverseComplement(r.forwardSeq);
    }

    // ---------- shuffle reads order for game, keep the read that starts at 0 as first (anchor) ----------
    const anchor = readObjs.reduce((acc, r) => (r.originalStart === 0 ? r : acc), readObjs[0]);
    const others = readObjs.filter((r) => r !== anchor);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const final = [anchor, ...others];

    final.forEach((r) => (r.used = true));
    return final;
  };

  // ---------- assemble using forwardSeq (declared overlap preferred) ----------
  const assembleSequenceFromReads = (readList, config) => {
    if (!readList || readList.length === 0) return "";
    let assembled = readList[0].forwardSeq; // always use forwardSeq for assembly correctness
    for (let i = 1; i < readList.length; i++) {
      const prev = assembled;
      const curr = readList[i].forwardSeq;
      const declared = readList[i].overlapWithPrev ?? null;
      const minOverlap = Math.max(3, config.minOverlap ?? 3);
      const maxSearch = Math.min(prev.length, curr.length, config.maxOverlap ?? Math.max(prev.length, curr.length));
      const best = findBestOverlap(prev, curr, declared, minOverlap, maxSearch);
      if (best > 0) {
        assembled = prev + curr.slice(best);
      } else {
        // no overlap => simple concat
        assembled = prev + curr;
      }
    }
    return assembled;
  };

  // ---------- similarity & success ----------
  const calculateSimilarity = (assembled, target) => {
    if (!assembled || !target) return 0;
    const minL = Math.min(assembled.length, target.length);
    if (minL === 0) return 0;
    let matches = 0;
    for (let i = 0; i < minL; i++) if (assembled[i] === target[i]) matches++;
    return matches / target.length;
  };
  const checkSuccess = (assembled, target, lvl) => {
    const sim = calculateSimilarity(assembled, target);
    if (lvl === 1) return sim >= 1.0;
    return sim >= 0.95;
  };

  // ---------- game control ----------
  const initGame = (useSeed = null) => {
    lastSuccessRef.current = false;
    setGameComplete(false);
    setAssembledSequence("");
    setReadMemos({});
    setShowMemoInput(null);

    // determine seed
    const actualSeed = (useSeed !== null ? useSeed : (seed !== null ? seed : getRandomSeed())) >>> 0;
    setSeed(actualSeed);

    const config = getLevelConfig(level);
    const dnaSeed = (actualSeed ^ 0x12345678) >>> 0;
    const readsSeed = (actualSeed ^ 0x9e3779b9) >>> 0;

    const dnaRng = createSeededRandom(dnaSeed);
    const target = generateRealisticDNA(config.length, dnaRng);

    const generatedReads = generateReadsFromReference(target, config, readsSeed);

    setTargetSequence(target);
    setReads(generatedReads);
    setSelectedReads(generatedReads.slice());
    setAssembledSequence("");
    setGameComplete(false);
    // Ensure score not changed here; success increments later once per success
    console.log(`Init with seed: ${actualSeed} (dnaSeed=${dnaSeed}, readsSeed=${readsSeed})`);
  };

  const reset = () => {
    const resetReads = [...reads].sort((a, b) => a.id - b.id).map((r) => ({ ...r, used: true }));
    setReads(resetReads);
    setSelectedReads(resetReads);
    setAssembledSequence("");
    setGameComplete(false);
    lastSuccessRef.current = false;
  };

  // ---------- drag & drop ----------
  const handleDragStart = (e, index) => {
    if (index === 0) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (index === 0) return;
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };
  const handleDragLeave = () => setDragOverIndex(null);
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || dropIndex === 0 || draggedIndex === 0) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newOrder = [...selectedReads];
    const dragged = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, dragged);
    setSelectedReads(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // ---------- effect: recompute assembly when selectedReads or target changes ----------
  useEffect(() => {
    if (!selectedReads || selectedReads.length === 0 || !targetSequence) {
      setAssembledSequence("");
      setGameComplete(false);
      lastSuccessRef.current = false;
      return;
    }
    const config = getLevelConfig(level);
    const assembled = assembleSequenceFromReads(selectedReads, config);
    setAssembledSequence(assembled);
    const success = checkSuccess(assembled, targetSequence, level);
    if (success && !lastSuccessRef.current) {
      setScore((s) => s + level * 150);
      lastSuccessRef.current = true;
      setGameComplete(true);
    } else if (!success) {
      lastSuccessRef.current = false;
      setGameComplete(false);
    }
  }, [selectedReads, targetSequence, level]);

  // init on mount and when level changes — always generate new random seed unless user specified one
  useEffect(() => {
    if (seedInput.trim() === "") {
      // Generate fresh random seed each time level changes
      initGame(null); // Let initGame generate its own seed
    } else {
      // Use user specified seed
      const parsed = Number(seedInput.trim());
      initGame(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // ---------- UI ----------
  const config = getLevelConfig(level);
  const similarity = assembledSequence ? calculateSimilarity(assembledSequence, targetSequence) : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-800 mb-2">🧬 ゲノムアセンブリチャレンジ</h1>
          <p className="text-gray-600">reference から生成した reads を並べ替えて元配列を復元しよう</p>

          <div className="flex justify-center items-center gap-4 mt-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 font-medium">レベル選択:</span>
              <div className="flex gap-1">
                {[1,2,3,4].map(n=>(
                  <button key={n} onClick={()=>setLevel(n)}
                    className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${level===n ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="ml-6 flex items-center gap-2">
              <input type="text" placeholder="seed (数値)" value={seedInput} onChange={(e)=>setSeedInput(e.target.value)}
                className="text-xs px-2 py-1 border rounded" />
              <button onClick={()=> {
                const parsed = seedInput.trim()==='' ? getRandomSeed() : Number(seedInput.trim());
                initGame(parsed);
              }} className="text-xs px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded">再現</button>
              <button onClick={()=> { initGame(); setSeedInput(''); }} className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">ランダム</button>
            </div>
          </div>

          <div className="flex justify-center items-center gap-4">
            <span className="bg-indigo-100 px-3 py-1 rounded-full text-sm font-semibold">レベル {level}: {config.description}</span>
            <span className="bg-green-100 px-3 py-1 rounded-full text-sm font-semibold">スコア: {score}</span>
            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700">Seed: {seed ?? '—'}</span>
          </div>
        </div>

        {/* hints */}
        {showHints && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-800">ヒント</h3>
              <button onClick={()=>setShowHints(false)} className="ml-auto text-yellow-600 hover:text-yellow-800 text-sm">×</button>
            </div>
            <div className="text-sm text-yellow-700">
              <div>• 各 read は reference から生成され、隣接 read 間の overlap 長を持ちます。</div>
              <div>• overlap 部分は reference 由来で、エラー注入から保護されています（必ず一致します）。</div>
              <div>• アセンブリは内部的に forwardSeq（reference向き）で結合します。表示は逆鎖の場合に見た目だけ反転します。</div>
            </div>
          </div>
        )}

        {/* stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-blue-700">{reads.length}</div>
            <div className="text-xs text-blue-600">Total Reads</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-green-700">{selectedReads.length}</div>
            <div className="text-xs text-green-600">Selected</div>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-purple-700">{targetSequence.length}</div>
            <div className="text-xs text-purple-600">Target Length</div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg text-center">
            <div className="text-lg font-bold text-orange-700">{Math.round(similarity*100)}%</div>
            <div className="text-xs text-orange-600">Similarity</div>
          </div>
        </div>

        {/* target */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">目標配列</h3>
            <button onClick={()=>setShowTarget(!showTarget)} className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">
              {showTarget ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showTarget ? '隠す' : '表示'}
            </button>
          </div>
          <div className="font-mono text-sm bg-white p-3 rounded border break-words">
            {showTarget ? (
              targetSequence.split("").map((b,i)=>(
                <span key={i} className={`${b==='A'?'text-red-600':''} ${b==='T'?'text-blue-600':''} ${b==='G'?'text-green-600':''} ${b==='C'?'text-purple-600':''} font-bold`}>{b}</span>
              ))
            ) : (
              <span className="text-gray-400">？？？（{targetSequence.length}文字）</span>
            )}
          </div>
        </div>

        {/* assembled */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">アセンブル結果</h3>
            <div className="text-sm text-gray-600">
              類似度: {Math.round(similarity*100)}% | 長さ: {assembledSequence.length}
              {selectedReads.length>0 && (
                <span className="ml-2 text-green-600 font-semibold">
                  {gameComplete ? '✅ 成功!' : '❌ 未達成'}
                </span>
              )}
            </div>
          </div>
          <div className="font-mono text-sm bg-white p-3 rounded border break-words">
            {assembledSequence ? (
              assembledSequence.split("").map((b,i)=>(
                <span key={i} className={`${b==='A'?'text-red-600':''} ${b==='T'?'text-blue-600':''} ${b==='G'?'text-green-600':''} ${b==='C'?'text-purple-600':''} font-bold`}>{b}</span>
              ))
            ) : (
              <span className="text-gray-400">DNA断片を選択してアセンブルを開始...</span>
            )}
          </div>
        </div>

        {/* selected reads */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">DNA断片の配置（{selectedReads.length}個） - ドラッグで順番変更（先頭固定）</h3>
            <button onClick={() => setShowOverlapHints(!showOverlapHints)} 
              className="flex items-center gap-1 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-sm">
              <Lightbulb className="w-4 h-4" /> 
              {showOverlapHints ? 'ヒント非表示' : 'オーバーラップヒント'}
            </button>
          </div>

          {selectedReads.length>0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {selectedReads.map((read, index) => (
                <div key={`${read.id}-${index}`}
                  draggable={index!==0}
                  onDragStart={index!==0 ? (e)=>handleDragStart(e,index) : undefined}
                  onDragOver={index!==0 ? (e)=>handleDragOver(e,index) : undefined}
                  onDragLeave={index!==0 ? handleDragLeave : undefined}
                  onDrop={index!==0 ? (e)=>handleDrop(e,index) : undefined}
                  onDragEnd={index!==0 ? handleDragEnd : undefined}
                  className={`relative transition-all duration-200 ${index===0 ? 'cursor-not-allowed bg-gray-100' : 'cursor-move'} ${draggedIndex===index ? 'opacity-50 scale-95' : ''} ${dragOverIndex===index ? 'transform translate-y-1' : ''}`}>
                  <div className={`h-full p-2 rounded-lg font-mono text-xs border text-left ${index===0 ? 'bg-blue-200 border-blue-400' : 'bg-green-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Read {index+1} {index===0? '(固定)':''}</span>
                        <span className="text-xs text-blue-600 font-semibold">{read.isReverse ? "3'→5' (逆鎖)" : "5'→3' (正鎖)"}</span>
                      </div>
                      <span className="text-xs text-gray-500">{read.length}bp {read.hasError ? '⚠️' : ''}</span>
                    </div>

                    <div className="break-words">
                      {read.displaySeq.split("").map((b,i)=>(
                        <span key={i} className={`${b==='A'?'text-red-700':''} ${b==='T'?'text-blue-700':''} ${b==='G'?'text-green-700':''} ${b==='C'?'text-purple-700':''} font-bold`}>{b}</span>
                      ))}
                    </div>

                    {/* overlap hints */}
                    {showOverlapHints && (
                      <div className="mt-2 text-xs text-gray-600">
                        <div>overlap(prev): {read.overlapWithPrev}</div>
                        <div>overlap(next): {read.overlapWithNext}</div>
                      </div>
                    )}

                    {/* memo */}
                    <div className="mt-1 relative">
                      <button onClick={()=> setShowMemoInput(showMemoInput===read.id? null : read.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${readMemos[read.id] ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <StickyNote className="w-3 h-3" />
                        {readMemos[read.id] ? 'メモ編集' : 'メモ追加'}
                      </button>
                      {readMemos[read.id] && <div className="mt-1 px-2 py-1 bg-blue-100 rounded text-xs text-blue-800">📝 {readMemos[read.id]}</div>}
                      {showMemoInput === read.id && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1 p-2 bg-white border-2 border-blue-300 rounded-lg shadow-lg">
                          <input type="text" placeholder="メモ（例：左端候補、overlap 8bp）"
                            value={readMemos[read.id] || ''}
                            onChange={(e)=> setReadMemos(prev=> ({...prev, [read.id]: e.target.value}))}
                            onKeyDown={(e)=> { if(e.key==='Enter' || e.key==='Escape'){ setShowMemoInput(null);} }}
                            onBlur={()=> setTimeout(()=> setShowMemoInput(null), 150)}
                            className="w-full text-xs px-2 py-1 border rounded focus:outline-none focus:border-blue-400" autoFocus />
                        </div>
                      )}
                    </div>
                  </div>

                  {dragOverIndex===index && draggedIndex!==index && (
                    <div className="absolute inset-0 border-2 border-blue-400 border-dashed rounded-lg pointer-events-none bg-blue-100 bg-opacity-30" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">DNA断片をドラッグで並び替えてアセンブリしましょう</div>
          )}

          {selectedReads.length>1 && (
            <div className="mt-4 text-xs text-gray-500 text-center">💡 DNA断片をドラッグして順番を調整し、正しい配列を作成しましょう</div>
          )}

          {selectedReads.length>0 && !gameComplete && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
              <div className="text-yellow-800 font-semibold">🧬 アセンブリ中...</div>
              <div className="text-yellow-700 text-sm mt-1">正しい隣接関係を作ると declared overlap（表示）で一致してアセンブリできます</div>
            </div>
          )}
        </div>

        {gameComplete && (
          <div className="mb-6 p-4 bg-green-100 border-2 border-green-400 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-bold text-green-800">🎉 レベル{level}クリア！</h3>
            </div>
            <p className="text-green-700 mb-2">類似度 {Math.round(similarity*100)}% で DNA 配列を復元しました！</p>
            <p className="text-green-600 text-sm mb-3">獲得スコア: {level * 150} 点</p>
            <button onClick={()=> setLevel(level<3 ? level+1 : 1)} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">
              {level < 3 ? `レベル${level+1}へ進む` : 'レベル1へ戻る'}
            </button>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4" /> リセット
          </button>
          <button onClick={() => initGame()} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
            <Shuffle className="w-4 h-4" /> 新しい問題
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <h4 className="font-semibold mb-2">💡 補足</h4>
          <div className="space-y-1">
            <div>• 各 read の overlap は read 自身のプロパティとして保持されます（overlapWithPrev/Next）。</div>
            <div>• overlap 部分は reference に由来しているため、エラーは入りません（必ず一致）。</div>
            <div>• アセンブリは forwardSeq（reference向き）を使って正しくマージします。表示は逆鎖の見た目をサポートします。</div>
            <div>• シードを指定すれば完全再現可能です（seed 表示・入力欄を利用してください）。</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenomeAssemblyGame;
