import { ChevronDown } from "lucide-react";
import { useAIStore, DEFAULT_MODELS } from "@store/aiStore";
import type { AIProvider } from "@/types/ai";
import { Icon } from "@components/shared/Icon";
import styles from "./ModelSelector.module.css";

const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "ollama", label: "Ollama (local)" },
  { id: "openrouter", label: "OpenRouter" },
];

export function ModelSelector() {
  const provider = useAIStore((s) => s.provider);
  const model = useAIStore((s) => s.model);
  const setProvider = useAIStore((s) => s.setProvider);

  return (
    <div className={styles.bar}>
      <div className={styles.dropdown}>
        <select
          className={styles.select}
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProvider)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <Icon icon={ChevronDown} size={10} className={styles.chevron} />
      </div>
      <span className={styles.model} title={model}>
        {model || DEFAULT_MODELS[provider]}
      </span>
    </div>
  );
}
