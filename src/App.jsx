import { useState, useEffect } from 'react';
import { Shuffle, RotateCcw, CheckCircle, Eye, EyeOff, Lightbulb, StickyNote } from 'lucide-react';

const GenomeAssemblyGame = () => {
  const [level, setLevel] = useState(1);
  const [targetSequence, setTargetSequence] = useState('');
  const [reads, setReads] = useState([]);
  const [selectedReads, setSelectedReads] = useState([]);
  const [assembledSequence, setAssembledSequence] = useState('');
  const [gameComplete, setGameComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [showTarget, setShowTarget] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [readMemos, setReadMemos] = useState({});
  const [showMemoInput, setShowMemoInput] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // ランダムシード生成関数 - より強力なランダム性を確保
  const getRandomSeed = () => {
    const crypto = window.crypto || window.msCrypto;
    let cryptoRandom = Math.random();
    
    if (crypto && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      cryptoRandom = array[0] / 4294967295; // normalize to 0-1
    }
    
    return Date.now() + 
           Math.random() * 1000000 + 
           performance.now() + 
           cryptoRandom * 1000000 +
           (Math.random() * 1000) + // additional entropy
           new Date().getMilliseconds();
  };

  // シード可能なランダム生成器
  const createSeededRandom = (seed) => {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  };

  // レベル別設定（仕様に合わせて修正）
  const getLevelConfig = (level) => {
    const configs = {
      1: { 
        length: 40, 
        numReads: 6,
        avgReadLength: 12, 
        readLengthVariation: 0.1,
        errorReads: 0,
        reverseReads: 0,
        description: "基礎編：エラーなし、正鎖のみ、6reads"
      },
      2: { 
        length: 60, 
        numReads: 6,
        avgReadLength: 18, 
        readLengthVariation: 0.2,
        errorReads: 1,
        reverseReads: 1,
        description: "応用編：エラー1個、逆鎖1個、6reads"
      },
      3: { 
        length: 100, 
        numReads: 6,
        avgReadLength: 30, 
        readLengthVariation: 0.25,
        errorReads: 1,
        reverseReads: 2,
        description: "上級編：長い配列、エラー1個、逆鎖2個、6reads"
      },
      4: {
        length: 1000,
        numReads: 20,
        avgReadLength: 100, 
        readLengthVariation: 0.3,
        errorReads: 5,
        reverseReads: 5,
        description: "実践編：さらに長い配列、エラー5個、逆鎖5個、20reads"
      }
    };
    return configs[level];
  };

  // 生物学的に現実的なDNA配列生成（同一塩基4連続以上を制限）
  const generateRealisticDNA = (length, random = Math.random) => {
    const bases = ['A', 'T', 'G', 'C'];
    const sequence = [];
    
    for (let i = 0; i < length; i++) {
      let base;
      let attempts = 0;
      
      do {
        base = bases[Math.floor(random() * 4)];
        attempts++;
        
        // 4回以上同じ塩基が連続するのを避ける
        const lastThree = sequence.slice(-3);
        if (lastThree.length < 3) break;
        if (!(lastThree[0] === base && lastThree[1] === base && lastThree[2] === base)) break;

        // 無限ループを避けるため、1000回試行したら諦める
        if (attempts > 1000) break;
      } while (attempts <= 1000);

      sequence.push(base);
    }
    
    return sequence.join('');
  };

  // リバースコンプリメント
  const reverseComplement = (seq) => {
    const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };
    return seq.split('').reverse().map(base => complement[base]).join('');
  };

  // シンプルなエラー導入関数 - overlap領域を完全に避ける
  const introduceError = (sequence, startPos, endPos, random = Math.random) => {
    const bases = ['A', 'T', 'G', 'C'];
    const overlapSize = 8; // 固定のoverlap保護サイズ
    
    // 保護すべき領域を計算（両端のoverlap領域）
    const safeStart = overlapSize;
    const safeEnd = sequence.length - overlapSize;
    
    // 安全な範囲がない場合は中央に配置
    if (safeEnd <= safeStart) {
      const centerPos = Math.floor(sequence.length / 2);
      const originalBase = sequence[centerPos];
      const possibleBases = bases.filter(b => b !== originalBase);
      const wrongBase = possibleBases[Math.floor(random() * possibleBases.length)];
      return sequence.substring(0, centerPos) + wrongBase + sequence.substring(centerPos + 1);
    }
    
    // 安全な範囲内でランダム選択
    const pos = safeStart + Math.floor(random() * (safeEnd - safeStart));
    const originalBase = sequence[pos];
    const possibleBases = bases.filter(b => b !== originalBase);
    const wrongBase = possibleBases[Math.floor(random() * possibleBases.length)];
    
    return sequence.substring(0, pos) + wrongBase + sequence.substring(pos + 1);
  };

  // シンプルなreads生成関数
  const generateReads = (sequence, config, providedSeed = null) => {
    const { numReads, avgReadLength, readLengthVariation, errorReads, reverseReads } = config;
    const seed = providedSeed || getRandomSeed();
    const random = createSeededRandom(seed);
    
    console.log(`Generating ${numReads} reads with seed: ${seed}`);
    
    // Step 1: シンプルな等間隔配置でread位置を決定
    const readPositions = [];
    const readLengths = [];
    
    // read長さを先に決定
    for (let i = 0; i < numReads; i++) {
      const lengthVar = 1 + (random() - 0.5) * 2 * readLengthVariation;
      const readLength = Math.max(10, Math.floor(avgReadLength * lengthVar));
      readLengths.push(readLength);
    }
    
    // 位置を等間隔に配置（最初は0、最後は末尾をカバー）
    readPositions[0] = 0;
    const lastReadLength = readLengths[numReads - 1];
    readPositions[numReads - 1] = Math.max(0, sequence.length - lastReadLength);
    
    // 中間のreadを等間隔配置
    for (let i = 1; i < numReads - 1; i++) {
      const ratio = i / (numReads - 1);
      const maxStartPos = sequence.length - readLengths[i];
      readPositions[i] = Math.floor(ratio * maxStartPos);
    }
    
    // Step 2: readsを生成
    const reads = [];
    for (let i = 0; i < numReads; i++) {
      const pos = readPositions[i];
      const length = readLengths[i];
      let readSeq = sequence.substring(pos, pos + length);
      
      reads.push({
        id: i,
        sequence: readSeq,
        originalStart: pos,
        length: length,
        isReverse: false,
        hasError: false,
        used: false
      });
    }
    
    // Step 3: ランダムに選択したreadにエラーを導入
    if (errorReads > 0) {
      const availableIndices = [...Array(numReads).keys()];
      for (let i = 0; i < errorReads; i++) {
        const randomIndex = Math.floor(random() * availableIndices.length);
        const readIndex = availableIndices.splice(randomIndex, 1)[0];
        
        const originalSeq = reads[readIndex].sequence;
        reads[readIndex].sequence = introduceError(
          originalSeq, 
          readPositions[readIndex],
          readPositions[readIndex] + readLengths[readIndex],
          random
        );
        reads[readIndex].hasError = true;
        console.log(`Error in read ${readIndex + 1}: ${originalSeq} -> ${reads[readIndex].sequence}`);
      }
    }
    
    // Step 4: ランダムに選択したreadを逆鎖に
    if (reverseReads > 0) {
      const availableIndices = reads
        .map((read, i) => read.hasError ? -1 : i)
        .filter(i => i !== -1); // エラーreadを除外
      
      for (let i = 0; i < Math.min(reverseReads, availableIndices.length); i++) {
        const randomIndex = Math.floor(random() * availableIndices.length);
        const readIndex = availableIndices.splice(randomIndex, 1)[0];
        
        const originalSeq = reads[readIndex].sequence;
        reads[readIndex].sequence = reverseComplement(originalSeq);
        reads[readIndex].isReverse = true;
        console.log(`Reverse read ${readIndex + 1}: ${originalSeq} -> ${reads[readIndex].sequence}`);
      }
    }
    
    // Step 5: 固定read id=0 + エラー/逆鎖をランダム配置
    
    // read id=0（位置0のread）を見つける
    const firstRead = reads.find(read => read.id === 0);
    const remainingReads = reads.filter(read => read.id !== 0);
    
    // 複数回の強力シャッフルでパターンを完全破壊
    const nowTime = Date.now();
    const microTime = performance.now();
    
    // 1回目: Fisher-Yatesアルゴリズム
    for (let i = remainingReads.length - 1; i > 0; i--) {
      const timeRandom = Math.sin(nowTime + i * 1000) / 2 + 0.5;
      const mathRandom = Math.random();
      const microRandom = Math.cos(microTime + i * 500) / 2 + 0.5;
      const combinedRandom = (timeRandom + mathRandom + microRandom) / 3;
      
      const j = Math.floor(combinedRandom * (i + 1));
      [remainingReads[i], remainingReads[j]] = [remainingReads[j], remainingReads[i]];
    }
    
    // 2回目: 配列をreverse後に再シャッフル
    if (Math.random() > 0.5) {
      remainingReads.reverse();
    }
    
    // 3回目: 時間ベースの最終シャッフル
    for (let round = 0; round < 3; round++) {
      const currentTime = Date.now() + round * 100;
      for (let i = remainingReads.length - 1; i > 0; i--) {
        const j = Math.floor((Math.sin(currentTime + i) / 2 + 0.5) * (i + 1));
        [remainingReads[i], remainingReads[j]] = [remainingReads[j], remainingReads[i]];
      }
    }
    
    const finalResult = [firstRead, ...remainingReads];
    
    console.log('Heavily shuffled result:');
    finalResult.forEach((read, i) => {
      const markers = [];
      if (read.hasError) markers.push('⚠️ERROR');
      if (read.isReverse) markers.push('↺REVERSE');
      console.log(`  ${i === 0 ? '🔒 FIXED' : 'RANDOM'} ${i + 1}: Read id=${read.id}, originalPos=${read.originalStart} ${markers.join(' ')}`);
    });
    
    // エラー・逆鎖readの位置を明確に追跡
    const errorPositions = finalResult.map((read, i) => read.hasError ? i + 1 : null).filter(p => p !== null);
    const reversePositions = finalResult.map((read, i) => read.isReverse ? i + 1 : null).filter(p => p !== null);
    
    if (errorPositions.length > 0) {
      console.log(`🚨 Error reads at positions: ${errorPositions.join(', ')}`);
    }
    if (reversePositions.length > 0) {
      console.log(`🔄 Reverse reads at positions: ${reversePositions.join(', ')}`);
    }
    
    return finalResult;
  };

  // overlap検出（逆鎖read対応版）
  const findBestOverlap = (seq1, seq2, minOverlap = 5) => {
    let bestOverlap = 0;
    let bestScore = 0;
    let useReverse = false;
    
    // 正鎖でのoverlap検出（seq2はすでに処理済み）
    for (let i = minOverlap; i <= Math.min(seq1.length, seq2.length); i++) {
      const suffix = seq1.slice(-i);
      const prefix = seq2.slice(0, i);
      
      if (suffix === prefix) {
        // 曖昧なoverlapかどうかをチェック
        const isAmbiguous = checkAmbiguousOverlap(suffix);
        if (!isAmbiguous) {
          // 曖昧でない場合のみ採用
          const score = i;
          if (score > bestScore) {
            bestOverlap = i;
            bestScore = score;
            useReverse = false;
          }
        }
      }
    }
    
    // さらにリバースコンプリメントを試す（レベル2以上）
    if (level >= 2) {
      const seq2Rev = reverseComplement(seq2);
      for (let i = minOverlap; i <= Math.min(seq1.length, seq2Rev.length); i++) {
        const suffix = seq1.slice(-i);
        const prefix = seq2Rev.slice(0, i);
        
        if (suffix === prefix) {
          const isAmbiguous = checkAmbiguousOverlap(suffix);
          if (!isAmbiguous) {
            const score = i;
            if (score > bestScore) {
              bestOverlap = i;
              bestScore = score;
              useReverse = true;
            }
          }
        }
      }
    }
    
    // 曖昧でないoverlapが見つからない場合、短いoverlapも許可
    if (bestOverlap === 0) {
      for (let i = 3; i < minOverlap; i++) {
        const suffix = seq1.slice(-i);
        const prefix = seq2.slice(0, i);
        
        if (suffix === prefix) {
          const isAmbiguous = checkAmbiguousOverlap(suffix);
          if (!isAmbiguous) {
            bestOverlap = i;
            bestScore = i * 0.5;
            useReverse = false;
            break;
          }
        }
      }
      
      // さらにリバースコンプリメントでも短いoverlapをチェック
      if (level >= 2 && bestOverlap === 0) {
        const seq2Rev = reverseComplement(seq2);
        for (let i = 3; i < minOverlap; i++) {
          const suffix = seq1.slice(-i);
          const prefix = seq2Rev.slice(0, i);
          
          if (suffix === prefix) {
            const isAmbiguous = checkAmbiguousOverlap(suffix);
            if (!isAmbiguous) {
              bestOverlap = i;
              bestScore = i * 0.5;
              useReverse = true;
              break;
            }
          }
        }
      }
    }
    
    return { overlap: bestOverlap, score: bestScore, useReverse };
  };

  // 曖昧なoverlapかどうかをチェック（改良版）
  const checkAmbiguousOverlap = (sequence) => {
    if (sequence.length <= 2) return true; // 3文字未満は曖昧
    
    // すべて同じ塩基かチェック（例：TTT、AAA）
    const firstBase = sequence[0];
    const allSame = sequence.split('').every(base => base === firstBase);
    if (allSame) return true;
    
    // 2文字の繰り返しかチェック（例：TATA、CGCG）
    if (sequence.length >= 4) {
      const pattern = sequence.slice(0, 2);
      let isRepeating = true;
      for (let i = 0; i < sequence.length; i += 2) {
        if (sequence.slice(i, i + 2) !== pattern) {
          isRepeating = false;
          break;
        }
      }
      if (isRepeating) return true;
    }
    
    return false;
  };

  // アセンブリアルゴリズム（逆鎖readの正しい処理）
  const assembleSequence = (readList) => {
    if (readList.length === 0) return '';
    if (readList.length === 1) {
      const read = readList[0];
      // 逆鎖readの場合はリバースコンプリメントして使用
      return read.isReverse ? reverseComplement(read.sequence) : read.sequence;
    }

    // 最初のreadを処理
    const firstRead = readList[0];
    let result = firstRead.isReverse ? reverseComplement(firstRead.sequence) : firstRead.sequence;
    let assemblyInfo = [
      `Read 1: ${firstRead.sequence} ${firstRead.isReverse ? '(3\'→5\', converted to: ' + reverseComplement(firstRead.sequence) + ')' : '(5\'→3\')'}`
    ];
    
    for (let i = 1; i < readList.length; i++) {
      const currentRead = readList[i];
      const currentSeq = currentRead.sequence;
      
      // 逆鎖readの場合はリバースコンプリメントしてからoverlapを検出
      const processedSeq = currentRead.isReverse ? reverseComplement(currentSeq) : currentSeq;
      const overlapInfo = findBestOverlap(result, processedSeq);
      
      if (overlapInfo.overlap > 0) {
        let nextSeq = processedSeq;
        
        // さらにリバースコンプリメントが必要な場合（overlapアルゴリズムが判断）
        if (overlapInfo.useReverse) {
          nextSeq = reverseComplement(processedSeq);
        }
        
        // overlapを除いて追加
        const newPart = nextSeq.slice(overlapInfo.overlap);
        result += newPart;
        
        const readInfo = currentRead.isReverse ? 
          `${currentSeq} (3'→5', converted to: ${processedSeq})` : 
          `${currentSeq} (5'→3')`;
        
        assemblyInfo.push(
          `Read ${i + 1}: ${readInfo}, overlap ${overlapInfo.overlap}bp${overlapInfo.useReverse ? ' (further reversed)' : ''}, added "${newPart}"`
        );
      } else {
        // overlapが見つからない場合、ギャップなしで単純連結
        const seqToAdd = processedSeq;
        result += seqToAdd;
        
        const readInfo = currentRead.isReverse ? 
          `${currentSeq} (3'→5', converted to: ${processedSeq})` : 
          `${currentSeq} (5'→3')`;
        
        assemblyInfo.push(`Read ${i + 1}: ${readInfo}, no valid overlap found, concatenated "${seqToAdd}"`);
      }
    }
    
    console.log('Assembly process:', assemblyInfo);
    return result;
  };

  // 類似度計算（エラー考慮版）
  const calculateSimilarity = (assembled, target) => {
    if (!assembled || !target) return 0;
    
    // ギャップ（N）を除去
    const cleanAssembled = assembled.replace(/N+/g, '');
    
    if (cleanAssembled.length === 0) return 0;
    
    // 1. 完全一致チェック
    if (cleanAssembled === target) return 1.0;
    
    // 2. エラーを考慮した類似度（レベル2,3用）
    if (level >= 2) {
      // 長さが大体合っているかチェック
      const lengthRatio = Math.min(cleanAssembled.length, target.length) / 
                         Math.max(cleanAssembled.length, target.length);
      
      if (lengthRatio < 0.8) return 0; // 長さが大きく異なる場合は失敗
      
      // 文字単位の一致率を計算
      let matches = 0;
      const minLength = Math.min(cleanAssembled.length, target.length);
      
      for (let i = 0; i < minLength; i++) {
        if (cleanAssembled[i] === target[i]) {
          matches++;
        }
      }
      
      const accuracy = matches / target.length;
      
      // エラーが1個までなら許容（95%以上の一致で成功とみなす）
      return accuracy;
    }
    
    // レベル1では完全一致のみ
    return 0;
  };

  // 成功判定
  const checkSuccess = (assembled, target) => {
    const similarity = calculateSimilarity(assembled, target);
    
    if (level === 1) {
      // レベル1は完全一致のみ
      return similarity >= 1.0;
    } else {
      // レベル2,3はエラー1個まで許容（95%以上の一致）
      return similarity >= 0.95;
    }
  };

  // ゲーム初期化
  const initGame = () => {
    // 強制的に状態をクリア
    setReads([]);
    setSelectedReads([]);
    setAssembledSequence('');
    setGameComplete(false);
    setReadMemos({});
    setShowMemoInput(null);
    
    const config = getLevelConfig(level);
    
    // 複数の独立したシードを生成
    const dnaGenSeed = getRandomSeed();
    const readsGenSeed = getRandomSeed() + 12345; // 異なるシードオフセット
    
    console.log(`=== NEW GAME INIT ===`);
    console.log(`DNA Generation Seed: ${dnaGenSeed}`);
    console.log(`Reads Generation Seed: ${readsGenSeed}`);
    
    const dnaRandom = createSeededRandom(dnaGenSeed);
    const newTarget = generateRealisticDNA(config.length, dnaRandom);
    const newReads = generateReads(newTarget, config, readsGenSeed); // シードを渡す
    
    setTargetSequence(newTarget);
    setReads(newReads);
    setSelectedReads(newReads); // 最初からすべて選択済み
    setAssembledSequence(''); // 初期状態では空
    setGameComplete(false);
    setReadMemos({});
    setShowMemoInput(null);
    
    // すべてのreadを使用済みにマーク
    const allUsedReads = newReads.map(r => ({...r, used: true}));
    setReads(allUsedReads);
  };

  // すべてのreadsがクリアされたかチェック
  const checkAllReadsUsed = () => {
    return reads.every(r => r.used);
  };

  // メモ機能
  const handleMemoChange = (readId, memo) => {
    setReadMemos(prev => ({
      ...prev,
      [readId]: memo
    }));
  };

  const toggleMemoInput = (readId) => {
    setShowMemoInput(showMemoInput === readId ? null : readId);
  };

  // ドラッグ&ドロップ機能
  const handleDragStart = (e, index) => {
    // 最初のread(index 0)はドラッグできない
    if (index === 0) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    // 最初のread(index 0)にはドロップできない
    if (index === 0) {
      return;
    }
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    // 最初のread(index 0)に対する操作は無効
    if (draggedIndex === null || draggedIndex === dropIndex || dropIndex === 0 || draggedIndex === 0) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSelectedReads = [...selectedReads];
    const draggedRead = newSelectedReads[draggedIndex];
    
    // 要素を削除して新しい位置に挿入
    newSelectedReads.splice(draggedIndex, 1);
    newSelectedReads.splice(dropIndex, 0, draggedRead);
    
    setSelectedReads(newSelectedReads);
    
    // 新しい順序でアセンブリを再計算
    const assembled = assembleSequence(newSelectedReads);
    setAssembledSequence(assembled);
    
    // 成功判定を即座に実行
    const success = checkSuccess(assembled, targetSequence);
    if (success) {
      setGameComplete(true);
      setScore(score + level * 150);
    } else {
      setGameComplete(false); // 失敗の場合は成功状態をリセット
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // リセット
  const reset = () => {
    // すべてのreadを使用済み状態で初期順序に戻す
    const resetReads = [...reads].sort((a, b) => a.id - b.id).map(r => ({...r, used: true}));
    setReads(resetReads);
    setSelectedReads(resetReads);
    setAssembledSequence('');
    setGameComplete(false);
  };

  // 次のレベル
  const nextLevel = () => {
    if (level < 3) {
      setLevel(level + 1);
    } else {
      setLevel(1);
    }
  };

  useEffect(() => {
    initGame();
  }, [level]);

  // 初回アセンブリ実行（selectedReadsが更新されたとき）
  useEffect(() => {
    if (selectedReads.length > 0) {
      const assembled = assembleSequence(selectedReads);
      setAssembledSequence(assembled);
      
      // 成功判定
      const success = checkSuccess(assembled, targetSequence);
      if (success) {
        setGameComplete(true);
        setScore(score + level * 150);
      } else {
        setGameComplete(false);
      }
    }
  }, [selectedReads, targetSequence]);

  const config = getLevelConfig(level);
  const similarity = assembledSequence ? calculateSimilarity(assembledSequence, targetSequence) : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-800 mb-2">
            🧬 ゲノムアセンブリチャレンジ
          </h1>
          <p className="text-gray-600">DNA断片から元の配列を復元しよう！</p>
          
          {/* レベル選択 */}
          <div className="flex justify-center items-center gap-4 mt-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 font-medium">レベル選択:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(levelNum => (
                  <button
                    key={levelNum}
                    onClick={() => setLevel(levelNum)}
                    className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                      level === levelNum
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {levelNum}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-center items-center gap-4">
            <span className="bg-indigo-100 px-3 py-1 rounded-full text-sm font-semibold">
              レベル {level}: {config.description}
            </span>
            <span className="bg-green-100 px-3 py-1 rounded-full text-sm font-semibold">
              スコア: {score}
            </span>
          </div>
        </div>

        {/* レベル別説明 */}
        {showHints && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-800">レベル{level}の特徴</h3>
              <button 
                onClick={() => setShowHints(false)}
                className="ml-auto text-yellow-600 hover:text-yellow-800 text-sm"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-yellow-700 space-y-1">
              {level === 1 && (
                <>
                  <div>• 6個のreadで完全なアセンブリ（エラーなし、正鎖のみ）</div>
                  <div>• 最初のreadは固定、残り5個を正しい順番に並べる</div>
                  <div>• 重複部分を見つけて完全一致を目指そう</div>
                </>
              )}
              {level === 2 && (
                <>
                  <div>• 6個のreadでアセンブリ（エラー1個、逆鎖1個含む）</div>
                  <div>• ⚠️マークはシーケンシングエラー、↺は逆鎖read</div>
                  <div>• エラー1個まで許容、95%以上の一致で成功</div>
                  <div>• メモ機能を活用して整理しよう</div>
                </>
              )}
              {level === 3 && (
                <>
                  <div>• 6個のreadで長い配列（120bp）をアセンブリ</div>
                  <div>• エラー1個、逆鎖2個含む実践的なデータ</div>
                  <div>• より戦略的なアプローチが必要</div>
                </>
              )}
                {level === 4 && (
                    <>
                    <div>• 1000bpの長大な配列を100万個のreadでアセンブリ</div>
                    <div>• エラー5個、逆鎖5個を含む現実的なシナリオ</div>
                    <div>• 高度な戦略とメモ機能が鍵</div>
                    </>
                )}
            </div>
          </div>
        )}

        {/* 統計情報 */}
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
            <div className="text-lg font-bold text-orange-700">{Math.round(similarity * 100)}%</div>
            <div className="text-xs text-orange-600">Similarity</div>
          </div>
        </div>

        {/* 目標配列 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">目標配列</h3>
            <button
              onClick={() => setShowTarget(!showTarget)}
              className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              {showTarget ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTarget ? '隠す' : '表示'}
            </button>
          </div>
          <div className="font-mono text-sm bg-white p-3 rounded border break-words">
            {showTarget ? (
              targetSequence.split('').map((base, i) => (
                <span
                  key={i}
                  className={`
                    font-bold
                    ${base === 'A' ? 'text-red-600' : ''}
                    ${base === 'T' ? 'text-blue-600' : ''}
                    ${base === 'G' ? 'text-green-600' : ''}
                    ${base === 'C' ? 'text-purple-600' : ''}
                  `}
                >
                  {base}
                </span>
              ))
            ) : (
              <span className="text-gray-400">？？？（{targetSequence.length}文字）</span>
            )}
          </div>
        </div>

        {/* 現在の結果 */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">アセンブル結果</h3>
            <div className="text-sm text-gray-600">
              類似度: {Math.round(similarity * 100)}% | 長さ: {assembledSequence.length}
              {checkAllReadsUsed() && (
                <span className="ml-2 text-green-600 font-semibold">
                  {checkSuccess(assembledSequence, targetSequence) ? '✅ 成功!' : 
                   level === 1 ? '❌ 完全一致が必要' : '❌ 95%以上の一致が必要'}
                </span>
              )}
            </div>
          </div>
          <div className="font-mono text-sm bg-white p-3 rounded border break-words">
            {assembledSequence ? (
              assembledSequence.split('').map((base, i) => (
                <span
                  key={i}
                  className={`
                    font-bold
                    ${base === 'A' ? 'text-red-600' : ''}
                    ${base === 'T' ? 'text-blue-600' : ''}
                    ${base === 'G' ? 'text-green-600' : ''}
                    ${base === 'C' ? 'text-purple-600' : ''}
                    ${base === 'N' ? 'text-gray-400 bg-gray-200' : ''}
                  `}
                >
                  {base}
                </span>
              ))
            ) : (
              <span className="text-gray-400">DNA断片を選択してアセンブルを開始...</span>
            )}
          </div>
        </div>

        {/* 選択済みの断片 */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3">
            DNA断片の配置（{selectedReads.length}個）- ドラッグで順番変更（1つ目は固定）
          </h3>
          
          {selectedReads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {selectedReads.map((read, index) => (
                <div
                  key={`${read.id}-${index}`}
                  draggable={index !== 0}
                  onDragStart={index !== 0 ? (e) => handleDragStart(e, index) : undefined}
                  onDragOver={index !== 0 ? (e) => handleDragOver(e, index) : undefined}
                  onDragLeave={index !== 0 ? handleDragLeave : undefined}
                  onDrop={index !== 0 ? (e) => handleDrop(e, index) : undefined}
                  onDragEnd={index !== 0 ? handleDragEnd : undefined}
                  className={`
                    relative transition-all duration-200
                    ${index === 0 ? 'cursor-not-allowed bg-gray-100' : 'cursor-move'}
                    ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
                    ${dragOverIndex === index ? 'transform translate-y-1' : ''}
                  `}
                >
                  <div className={`h-full p-2 rounded-lg font-mono text-xs border text-left ${
                    index === 0 ? 'bg-blue-200 border-blue-400' : 'bg-green-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          Read {index + 1} {index === 0 ? '(固定)' : ''}
                        </span>
                        <span className="text-xs text-blue-600 font-semibold">
                          {read.isReverse ? "3'→5' (逆鎖)" : "5'→3' (正鎖)"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {read.length}bp {read.hasError ? '⚠️' : ''} {read.isReverse ? '↺' : ''}
                      </span>
                    </div>
                    <div className='break-words'>
                      {read.sequence.split('').map((base, i) => (
                        <span
                          key={i}
                          className={`
                            font-bold
                            ${base === 'A' ? 'text-red-700' : ''}
                            ${base === 'T' ? 'text-blue-700' : ''}
                            ${base === 'G' ? 'text-green-700' : ''}
                            ${base === 'C' ? 'text-purple-700' : ''}
                          `}
                        >
                          {base}
                        </span>
                      ))}
                    </div>
                    {level >= 2 && (
                      <div className="mt-1 relative">
                        <button
                          onClick={() => toggleMemoInput(read.id)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                            readMemos[read.id] ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <StickyNote className="w-3 h-3" />
                          {readMemos[read.id] ? 'メモ編集' : 'メモ追加'}
                        </button>
                        {readMemos[read.id] && (
                          <div className="mt-1 px-2 py-1 bg-blue-100 rounded text-xs text-blue-800">
                            📝 {readMemos[read.id]}
                          </div>
                        )}
                        
                        {/* メモ入力 */}
                        {showMemoInput === read.id && (
                          <div className="absolute top-full left-0 right-0 z-10 mt-1 p-2 bg-white border-2 border-blue-300 rounded-lg shadow-lg">
                            <input
                              type="text"
                              placeholder="メモ（例：左端候補、overlap 8bp）"
                              value={readMemos[read.id] || ''}
                              onChange={(e) => handleMemoChange(read.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  setShowMemoInput(null);
                                }
                              }}
                              onBlur={() => setTimeout(() => setShowMemoInput(null), 150)}
                              className="w-full text-xs px-2 py-1 border rounded focus:outline-none focus:border-blue-400"
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* ドラッグ中の視覚的フィードバック */}
                  {dragOverIndex === index && draggedIndex !== index && (
                    <div className="absolute inset-0 border-2 border-blue-400 border-dashed rounded-lg pointer-events-none bg-blue-100 bg-opacity-30" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
              DNA断片をドラッグで並び替えてアセンブリしましょう
            </div>
          )}
          
          {/* ドラッグ操作のヒント */}
          {selectedReads.length > 1 && (
            <div className="mt-4 text-xs text-gray-500 text-center">
              💡 DNA断片をドラッグして順番を変更し、正しい配列を作成しましょう
            </div>
          )}
          
          {/* 自動アセンブリ完了メッセージ */}
          {selectedReads.length > 0 && !gameComplete && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
              <div className="text-yellow-800 font-semibold">🧬 DNA断片を並び替えてアセンブリ中...</div>
              <div className="text-yellow-700 text-sm mt-1">
                {level === 1 ? 
                  '順番を調整して完全に一致する配列を作成しましょう' :
                  '順番を調整して95%以上の一致を目指しましょう（エラー1個まで許容）'
                }
              </div>
            </div>
          )}
        </div>

        {/* 成功メッセージ */}
        {gameComplete && (
          <div className="mb-6 p-4 bg-green-100 border-2 border-green-400 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-bold text-green-800">🎉 レベル{level}クリア！</h3>
            </div>
            <p className="text-green-700 mb-2">
              類似度{Math.round(similarity * 100)}%でDNA配列を復元しました！
            </p>
            <p className="text-green-600 text-sm mb-3">
              獲得スコア: {level * 150}点
            </p>
            <button
              onClick={nextLevel}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              {level < 3 ? `レベル${level + 1}へ進む` : 'レベル1へ戻る'}
            </button>
          </div>
        )}

        {/* コントロール */}
        <div className="flex justify-center gap-4">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            リセット
          </button>
          <button
            onClick={initGame}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            新しい問題
          </button>
        </div>

        {/* ヒント */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <h4 className="font-semibold mb-2">💡</h4>
          <div className="space-y-1">
            <div>• <strong className="text-red-600">A</strong>=赤, <strong className="text-blue-600">T</strong>=青, <strong className="text-green-600">G</strong>=緑, <strong className="text-purple-600">C</strong>=紫</div>
            <div>• ⚠️ = シーケンシングエラー含む, ↺ = 逆鎖（リバースコンプリメント）</div>
            <div>• 5'→3'方向：正鎖DNAの標準的な読み取り方向</div>
            <div>• 3'→5'方向：逆鎖DNAの読み取り方向（リバースコンプリメント）</div>
            <div>• 逆鎖read：相補的な塩基に変換して逆向きにしたもの（例：ATGC → GCAT）</div>
            <div>• より長い非曖昧なoverlapを見つけることで正確なアセンブリができます</div>
            <div>• すべてのreadを正しい順序で配置して目標配列を復元しよう</div>
            {level >= 2 && <div>• メモ機能を使って戦略的にアプローチしよう</div>}
            {level >= 2 && <div>• エラーがあるreadは完全一致しない場合があります</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenomeAssemblyGame;