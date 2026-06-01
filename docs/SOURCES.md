# Source Synthesis

This framework is distilled from four external references.

## OpenAI: Harness Engineering

Source: <https://openai.com/index/harness-engineering/>

Key takeaways:

- humans should steer and shape the environment while agents execute
- repository-local knowledge should be the system of record
- `AGENTS.md` works best as a short map into deeper docs
- agent legibility matters more than human cleverness
- architectural boundaries and taste should be enforced mechanically
- recurring cleanup is required because agent-generated systems drift

## Anthropic: Harness Design For Long-Running Application Development

Source: <https://www.anthropic.com/engineering/harness-design-long-running-apps>

Key takeaways:

- long-running work benefits from explicit planner, generator, and evaluator roles
- high-level specs are useful, but each sprint still needs a concrete contract
- evaluation must be adversarial enough to catch real failures
- context resets or compaction strategy must be deliberate, not accidental
- every harness component encodes an assumption, so simplify when the model no longer needs it

## GSD: Get Shit Done

Source: <https://github.com/gsd-build/get-shit-done>

Key takeaways:

- file-based state can survive context resets and session boundaries
- phase-oriented workflows keep planning and execution bounded
- thin orchestrators plus specialized agents work better than one overloaded agent
- active state, plans, reviews, threads, backlog items, and seeds should all be explicit artifacts
- verification and UAT should be part of the workflow, not an afterthought

## Karpathy: LLM Wiki

Source: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>

Key takeaways:

- the agent should maintain a persistent knowledge layer, not rediscover everything each time
- indexes and append-only logs are lightweight but high-leverage navigation tools
- useful answers should be written back into the knowledge base
- the schema that tells the agent how to maintain the knowledge base is itself a core artifact

## Combined Position

The practical pattern is:

1. Keep intent, knowledge, plans, and state in the repo.
2. Keep entry documents short and navigational.
3. Force work through scoped contracts and evaluations.
4. Reset context aggressively when written artifacts are strong enough.
5. Turn repeated taste and architecture feedback into code-enforced constraints.
6. Treat the repository as a living wiki for the project, not just a pile of source files.
