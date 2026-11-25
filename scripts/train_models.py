"""
Train and evaluate classical ML models for financial sentiment classification.
Datasets (genuine, publicly available):
  1. Twitter Financial News Sentiment (zeroshot) - MIT license - 11,931 tweets
     Labels: 0=Bearish(negative), 1=Bullish(positive), 2=Neutral
  2. Financial PhraseBank AllAgree (Malo et al. 2014) - CC BY-NC-SA 3.0 - 2,264 sentences
     Labels: positive/negative/neutral (financial news sentences, NOT social media)

Models: MultinomialNB, LogisticRegression, LinearSVC, RandomForest
Features: TF-IDF (unigram+bigram, min_df=2)
Split: stratified 80:20, random_state=42
Metrics: accuracy, macro precision/recall/F1, confusion matrix, classification report
"""
import re, json, time, pickle, os
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
from sklearn.pipeline import Pipeline

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "..", "backend", "data")
OUT = os.path.join(BASE, "..", "backend", "data", "models")
os.makedirs(OUT, exist_ok=True)

LABEL_MAP_TWITTER = {0: "negative", 1: "positive", 2: "neutral"}  # Bearish, Bullish, Neutral

def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    t = text.lower()
    t = re.sub(r"https?://\S+|www\.\S+", " ", t)
    t = re.sub(r"@\w+", " ", t)
    t = re.sub(r"\$([a-z]{1,5})\b", r" ticker_\1 ", t)  # preserve tickers as tokens
    t = re.sub(r"#(\w+)", r" \1 ", t)
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def load_twitter():
    tr = pd.read_csv(os.path.join(DATA, "sent_train.csv"))
    va = pd.read_csv(os.path.join(DATA, "sent_valid.csv"))
    df = pd.concat([tr, va], ignore_index=True)
    df["label_str"] = df["label"].map(LABEL_MAP_TWITTER)
    df["source"] = "twitter_financial_news"
    df["text_clean"] = df["text"].apply(clean_text)
    return df[["text", "text_clean", "label_str", "source"]]

def load_phrasebank():
    path = os.path.join(DATA, "phrasebank_raw", "FinancialPhraseBank-v1.0", "Sentences_AllAgree.txt")
    rows = []
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line or "@" not in line:
                continue
            sent, lab = line.rsplit("@", 1)
            lab = lab.strip().lower()
            if lab not in ("positive", "negative", "neutral"):
                continue
            rows.append({"text": sent.strip(), "label_str": lab, "source": "financial_phrasebank"})
    df = pd.DataFrame(rows)
    df["text_clean"] = df["text"].apply(clean_text)
    return df[["text", "text_clean", "label_str", "source"]]

def get_models():
    return {
        "Multinomial Naive Bayes": MultinomialNB(),
        "Logistic Regression": LogisticRegression(max_iter=1000, solver="lbfgs", multi_class="auto"),
        "Linear SVM": LinearSVC(max_iter=2000, dual="auto"),
        "Random Forest": RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1),
    }

def evaluate(name, model, X_test, y_test):
    t0 = time.time()
    model.fit(X_test[0], X_test[1]) if isinstance(X_test, tuple) else None
    return None

def run_experiment(df, dataset_name, test_size=0.2):
    print(f"\n{'='*70}\nEXPERIMENT: {dataset_name}  n={len(df)}")
    print(df["label_str"].value_counts().to_dict())
    X = df["text_clean"].values
    y = df["label_str"].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    print(f"Train: {len(X_train)}, Test: {len(X_test)}")
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=20000, sublinear_tf=True)
    Xtr = vectorizer.fit_transform(X_train)
    Xte = vectorizer.transform(X_test)
    print(f"TF-IDF features: {Xtr.shape[1]}")

    results = []
    trained = {}
    for name, clf in get_models().items():
        t0 = time.time()
        clf.fit(Xtr, y_train)
        train_time = time.time() - t0
        t1 = time.time()
        pred = clf.predict(Xte)
        infer_time = time.time() - t1
        acc = accuracy_score(y_test, pred)
        prec = precision_score(y_test, pred, average="macro", zero_division=0)
        rec = recall_score(y_test, pred, average="macro", zero_division=0)
        f1 = f1_score(y_test, pred, average="macro", zero_division=0)
        cm = confusion_matrix(y_test, pred, labels=["negative", "neutral", "positive"]).tolist()
        report = classification_report(y_test, pred, output_dict=True, zero_division=0)
        print(f"{name}: acc={acc:.4f} P={prec:.4f} R={rec:.4f} F1={f1:.4f} train={train_time:.2f}s")
        results.append({
            "model": name, "dataset": dataset_name,
            "accuracy": round(float(acc), 4), "precision_macro": round(float(prec), 4),
            "recall_macro": round(float(rec), 4), "f1_macro": round(float(f1), 4),
            "train_time_s": round(float(train_time), 3), "inference_time_s": round(float(infer_time), 4),
            "n_train": int(len(X_train)), "n_test": int(len(X_test)),
            "confusion_matrix": cm,
            "labels_order": ["negative", "neutral", "positive"],
            "classification_report": report,
        })
        trained[name] = clf
    return results, vectorizer, trained, (X_train, X_test, y_train, y_test)

def main():
    tw = load_twitter()
    pb = load_phrasebank()
    print(f"Twitter: {tw.shape}, PhraseBank: {pb.shape}")
    # Save processed
    tw.to_csv(os.path.join(DATA, "processed_twitter.csv"), index=False)
    pb.to_csv(os.path.join(DATA, "processed_phrasebank.csv"), index=False)

    all_results = []
    # Experiment 1: Twitter (main)
    res1, vec1, models1, splits1 = run_experiment(tw, "twitter_financial_news")
    all_results.extend(res1)
    # Experiment 2: PhraseBank
    res2, vec2, models2, splits2 = run_experiment(pb, "financial_phrasebank")
    all_results.extend(res2)

    # Cross-domain: train on Twitter, test on PhraseBank (and vice versa) using best model type (LogReg)
    print("\n--- Cross-domain evaluation (Logistic Regression) ---")
    cross = []
    for train_df, test_df, name in [(tw, pb, "train_twitter_test_phrasebank"), (pb, tw, "train_phrasebank_test_twitter")]:
        v = TfidfVectorizer(ngram_range=(1,2), min_df=2, max_features=20000, sublinear_tf=True)
        Xtr = v.fit_transform(train_df["text_clean"])
        Xte = v.transform(test_df["text_clean"])
        clf = LogisticRegression(max_iter=1000)
        clf.fit(Xtr, train_df["label_str"])
        pred = clf.predict(Xte)
        acc = accuracy_score(test_df["label_str"], pred)
        f1 = f1_score(test_df["label_str"], pred, average="macro", zero_division=0)
        print(f"{name}: acc={acc:.4f} F1={f1:.4f}")
        cross.append({"experiment": name, "model": "Logistic Regression", "accuracy": round(float(acc),4), "f1_macro": round(float(f1),4)})

    # Save best Twitter model (by F1) for inference
    best = max(res1, key=lambda r: r["f1_macro"])
    print(f"\nBest Twitter model: {best['model']} F1={best['f1_macro']}")
    with open(os.path.join(OUT, "vectorizer.pkl"), "wb") as f:
        pickle.dump(vec1, f)
    with open(os.path.join(OUT, "best_model.pkl"), "wb") as f:
        pickle.dump(models1[best["model"]], f)
    # Save all models (large: RandomForest pickle is ~85 MB). Optional — only the
    # best model is required for inference; the API falls back to it if this file is absent.
    save_all = os.getenv("SAVE_ALL_MODELS", "1") == "1"
    if save_all:
        with open(os.path.join(OUT, "all_models.pkl"), "wb") as f:
            pickle.dump(models1, f)
    with open(os.path.join(OUT, "model_info.json"), "w") as f:
        json.dump({"best_model": best["model"], "labels": ["negative","neutral","positive"],
                   "trained_on": "twitter_financial_news (11,931 tweets)", "tfidf": {"ngram_range":[1,2],"min_df":2,"max_features":20000}}, f, indent=2)

    with open(os.path.join(OUT, "evaluation_results.json"), "w") as f:
        json.dump({"results": all_results, "cross_domain": cross,
                   "dataset_info": {
                       "twitter_financial_news": {"n": int(len(tw)), "dist": tw["label_str"].value_counts().to_dict(),
                           "source": "https://huggingface.co/datasets/zeroshot/twitter-financial-news-sentiment", "license": "MIT"},
                       "financial_phrasebank": {"n": int(len(pb)), "dist": pb["label_str"].value_counts().to_dict(),
                           "source": "https://huggingface.co/datasets/takala/financial_phrasebank (Malo et al. 2014)", "license": "CC BY-NC-SA 3.0"},
                   }}, f, indent=2)
    print("\nSaved models + evaluation_results.json to", OUT)

if __name__ == "__main__":
    main()
