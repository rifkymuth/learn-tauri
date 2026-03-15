# Module 01: Rust Fundamentals for JavaScript/React Developers

> **Goal**: Learn enough Rust to be productive with Tauri. This is not a complete Rust course — it focuses on the concepts you will actually use when building Tauri desktop apps.

> **Estimated time**: 3-4 hours

> **Prerequisites**: Comfortable with JavaScript/TypeScript and React. No Rust experience required.

---

## Table of Contents

1. [Installing Rust](#1-installing-rust)
2. [Cargo Basics](#2-cargo-basics)
3. [Variables and Types](#3-variables-and-types)
4. [Functions](#4-functions)
5. [Ownership and Borrowing](#5-ownership-and-borrowing)
6. [Structs and Enums](#6-structs-and-enums)
7. [Error Handling](#7-error-handling)
8. [Collections](#8-collections)
9. [Traits](#9-traits)
10. [Modules and Crates](#10-modules-and-crates)
11. [Closures](#11-closures)
12. [Async/Await](#12-asyncawait)
13. [Coding Challenges](#13-coding-challenges)

---

## 1. Installing Rust

### What You Need

Rust has three core tools, roughly analogous to the Node.js ecosystem:

| Rust Tool | Node.js Equivalent | Purpose |
|-----------|-------------------|---------|
| `rustup` | `nvm` | Toolchain manager (install/update Rust versions) |
| `cargo` | `npm` | Package manager, build tool, test runner, everything |
| `rustc` | `node` (the runtime) | The Rust compiler (you rarely call it directly) |

### Installation

```bash
# macOS / Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows: Download and run rustup-init.exe from https://rustup.rs

# Verify installation
rustc --version
cargo --version
```

After installation, restart your terminal so `cargo` is on your PATH.

### Editor Setup

Install the **rust-analyzer** extension for VS Code. It gives you autocomplete, inline type hints, error highlighting, and go-to-definition. This is not optional — Rust without rust-analyzer is a much worse experience.

### Keeping Rust Updated

```bash
rustup update          # Update to the latest stable Rust
rustup self update     # Update rustup itself
```

---

## 2. Cargo Basics

Cargo is your single tool for everything in Rust development. If you know `npm`, you already understand the mental model.

### Cargo vs npm

| Task | npm | Cargo |
|------|-----|-------|
| Create a new project | `npm init` | `cargo new my_project` |
| Install dependencies | `npm install` | `cargo build` (reads Cargo.toml) |
| Run the project | `npm start` / `node index.js` | `cargo run` |
| Run tests | `npm test` | `cargo test` |
| Build for production | `npm run build` | `cargo build --release` |
| Lint / check | `eslint .` | `cargo clippy` |
| Format code | `prettier --write .` | `cargo fmt` |
| Project manifest | `package.json` | `Cargo.toml` |
| Lock file | `package-lock.json` | `Cargo.lock` |
| Package registry | npmjs.com | crates.io |

### Creating a Project

```bash
cargo new my_project       # Creates a binary project (has a main function)
cargo new my_lib --lib     # Creates a library project
```

This generates:

```
my_project/
├── Cargo.toml       # Project manifest (like package.json)
├── src/
│   └── main.rs      # Entry point (like index.js)
```

### Cargo.toml

```toml
[package]
name = "my_project"
version = "0.1.0"
edition = "2021"          # Rust edition — always use 2021

[dependencies]
serde = { version = "1", features = ["derive"] }    # Like adding to package.json
serde_json = "1"
```

**Key difference from npm**: You do not run a separate install command. When you `cargo build` or `cargo run`, Cargo reads `Cargo.toml`, downloads dependencies, and compiles everything.

### Essential Cargo Commands

```bash
cargo run              # Compile and run (like npm start)
cargo build            # Compile only (debug build)
cargo build --release  # Compile optimized (for production)
cargo check            # Fast type-check without building (use this often!)
cargo test             # Run all tests
cargo fmt              # Format code
cargo clippy           # Linting — catch common mistakes and non-idiomatic code
cargo doc --open       # Generate and open docs for your project and its dependencies
cargo add serde        # Add a dependency (like npm install serde)
```

> **Tip**: During development, use `cargo check` instead of `cargo build`. It is much faster because it skips the code-generation step. It will still catch all type errors and borrow checker issues.

---

## 3. Variables and Types

### JS vs Rust: The Big Differences

In JavaScript, variables are mutable by default and types are determined at runtime. In Rust, it is the opposite: variables are **immutable by default** and types are determined at **compile time**.

```javascript
// JavaScript
let name = "Alice";         // mutable (can reassign)
const age = 30;             // immutable
let anything = "hello";
anything = 42;              // JS doesn't care about types
```

```rust
// Rust
let name = "Alice";         // IMMUTABLE by default
let mut age = 30;           // "mut" makes it mutable
// name = "Bob";            // ERROR: cannot assign twice to immutable variable

let mut anything = "hello";
// anything = 42;           // ERROR: expected &str, found integer
```

### Type Inference

Rust has type inference, so you often do not need to write types explicitly. But you always *can*:

```rust
let x = 5;                  // Rust infers: i32
let y: f64 = 3.14;          // Explicit type annotation
let name = String::from("Alice");  // Rust infers: String
let active = true;          // Rust infers: bool
```

### Common Types

| Rust Type | JS Equivalent | Notes |
|-----------|---------------|-------|
| `i32` | `number` | 32-bit signed integer (default for integers) |
| `i64` | `number` / `BigInt` | 64-bit signed integer |
| `u32` | `number` | 32-bit unsigned integer (no negatives) |
| `usize` | `number` | Pointer-sized unsigned int (used for indices) |
| `f64` | `number` | 64-bit float (default for decimals) |
| `bool` | `boolean` | `true` or `false` |
| `char` | N/A | A single Unicode character: `'a'`, `'Z'` |
| `String` | `string` | Owned, growable string (heap-allocated) |
| `&str` | `string` | String slice/reference (borrowed, often a literal) |
| `()` | `undefined` / `void` | The "unit" type — means "nothing" |

### String vs &str: The Most Common Gotcha

This trips up every JS developer. Rust has two main string types:

```rust
// &str — a string slice. Think of it as a "view" into string data.
// String literals are &str. You cannot modify them.
let greeting: &str = "hello";

// String — an owned, heap-allocated string. You can modify it.
let mut name: String = String::from("Alice");
name.push_str(" Smith");

// Converting between them:
let s: String = "hello".to_string();   // &str -> String
let s: String = String::from("hello"); // &str -> String
let r: &str = &s;                      // String -> &str (borrowing)
```

**When will you encounter this in Tauri?** All the time. Tauri command arguments and return types often require `String` (owned) rather than `&str` (borrowed). When in doubt, use `String`.

### Shadowing

Rust lets you re-declare a variable with the same name. This is called shadowing and is perfectly idiomatic:

```rust
let x = 5;
let x = x + 1;          // New variable shadows the old one
let x = x * 2;          // Shadows again — x is now 12

// You can even change the type:
let spaces = "   ";      // &str
let spaces = spaces.len(); // usize — this is fine because it's a new variable
```

---

## 4. Functions

### JS vs Rust

```javascript
// JavaScript
function greet(name) {
  return `Hello, ${name}!`;
}

// Arrow function
const add = (a, b) => a + b;
```

```rust
// Rust — all parameter types and return types must be specified
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)   // No semicolon = this is the return value
}

fn add(a: i32, b: i32) -> i32 {
    a + b                         // No semicolon = implicit return
}
```

### Key Differences

1. **Types are mandatory** on function signatures. No exceptions.
2. **Implicit return**: The last expression without a semicolon is the return value. Adding a semicolon turns it into a statement that returns `()` (nothing).
3. You can also use `return` explicitly for early returns.

```rust
fn classify_age(age: u32) -> &'static str {
    if age < 13 {
        return "child";    // Early return with explicit "return" keyword
    }

    if age < 20 {
        "teenager"         // Implicit return (no semicolon)
    } else {
        "adult"            // Implicit return
    }
}
```

> **The semicolon trap**: This is a real gotcha.
> ```rust
> fn broken() -> i32 {
>     5;   // The semicolon makes this a statement, so the function returns ()
>          // ERROR: expected i32, found ()
> }
> ```

### Functions in Tauri

In Tauri, your backend commands are Rust functions decorated with `#[tauri::command]`:

```rust
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}! Welcome to Tauri.", name)
}
```

This function can then be called from your React frontend via `invoke("greet", { name: "Alice" })`.

---

## 5. Ownership and Borrowing

This is **the** concept that makes Rust different from every other language you have used. It is also the concept that causes the most compiler errors when you are starting out. Take your time here.

### Why Does Rust Have Ownership?

JavaScript uses garbage collection: the runtime periodically scans memory and frees anything that is no longer referenced. This is simple but has costs (GC pauses, memory overhead).

Rust has **no garbage collector**. Instead, the compiler tracks who "owns" each piece of data and inserts the cleanup code at exactly the right place. This gives you C-level performance with memory safety guarantees — and zero runtime cost.

### The Three Rules of Ownership

1. Every value in Rust has exactly **one owner** (a variable).
2. When the owner goes out of scope, the value is **dropped** (freed).
3. Ownership can be **moved** to another variable, but then the original can no longer be used.

### The Book Analogy

Think of a `String` as a physical book:

- **Ownership** = You own the book. It sits on your shelf.
- **Move** = You give the book to a friend. You no longer have it. You cannot read it.
- **Borrow (`&`)** = You lend the book to a friend. They can read it, but they must give it back. You still own it.
- **Mutable borrow (`&mut`)** = You lend the book to a friend and they are allowed to write notes in it. While they have it, nobody else can even look at it.

### Ownership and Moves

```rust
let s1 = String::from("hello");
let s2 = s1;                    // s1's ownership MOVES to s2

// println!("{}", s1);           // ERROR: s1 is no longer valid — the value moved
println!("{}", s2);              // Fine — s2 owns the string now
```

Compare to JavaScript, where this would just create two references to the same string and both would work fine.

```javascript
// JavaScript — no ownership concept
let s1 = "hello";
let s2 = s1;
console.log(s1);  // Works fine — both s1 and s2 point to the same data
```

> **Note**: Simple types like `i32`, `f64`, and `bool` are **copied** instead of moved, because they are small and live on the stack. So `let x = 5; let y = x;` is fine — both `x` and `y` are valid.

### Borrowing with `&` (Immutable References)

Instead of moving ownership, you can *borrow* a value:

```rust
fn print_length(s: &String) {   // Takes a reference — borrows, does not own
    println!("Length: {}", s.len());
}   // s goes out of scope, but since it doesn't own the String, nothing happens

fn main() {
    let my_string = String::from("hello");
    print_length(&my_string);    // Lend it out with &
    println!("{}", my_string);   // Still valid! We only lent it, we didn't give it away.
}
```

You can have **multiple immutable borrows** at the same time:

```rust
let s = String::from("hello");
let r1 = &s;
let r2 = &s;  // Fine — multiple readers allowed
println!("{} and {}", r1, r2);
```

### Mutable Borrowing with `&mut`

If you want to modify borrowed data, you need a mutable reference:

```rust
fn add_exclamation(s: &mut String) {
    s.push_str("!");
}

fn main() {
    let mut my_string = String::from("hello");
    add_exclamation(&mut my_string);
    println!("{}", my_string);   // Prints "hello!"
}
```

**The key rule**: You can have either:
- **Many** immutable references (`&T`), OR
- **One** mutable reference (`&mut T`)

Never both at the same time. This prevents data races at compile time.

```rust
let mut s = String::from("hello");

let r1 = &s;       // Immutable borrow
let r2 = &s;       // Another immutable borrow — fine
// let r3 = &mut s; // ERROR: cannot borrow `s` as mutable because it is also
                     //        borrowed as immutable
```

### Lifetimes (The Basics)

Lifetimes ensure that references do not outlive the data they point to. Most of the time, the compiler infers lifetimes for you. You will see lifetime annotations (`'a`) in function signatures occasionally:

```rust
// This says: the returned reference lives as long as the input reference
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for (i, &byte) in bytes.iter().enumerate() {
        if byte == b' ' {
            return &s[..i];
        }
    }
    s
}
```

**For Tauri development**, you rarely need to write explicit lifetime annotations. Tauri commands typically take owned types (`String`, `Vec<T>`) rather than references, which sidesteps lifetime complexity. If the compiler asks you for lifetime annotations and you are stuck, try switching from `&str` to `String`.

### Ownership Cheat Sheet

| Situation | What to use |
|-----------|-------------|
| Function needs to read data | `&T` (borrow) |
| Function needs to modify data | `&mut T` (mutable borrow) |
| Function needs to take ownership | `T` (owned) |
| Returning data from a function | `T` (owned — return a `String`, not `&str`) |
| Tauri command parameters | `T` (owned — Tauri deserializes into owned types) |

---

## 6. Structs and Enums

### Structs: Like JS Objects, But Typed

In JavaScript, objects are flexible bags of properties. In Rust, structs define a fixed shape with known types.

```javascript
// JavaScript
const user = {
  name: "Alice",
  age: 30,
  active: true,
};
```

```rust
// Rust — define the shape first, then create instances
struct User {
    name: String,
    age: u32,
    active: bool,
}

let user = User {
    name: String::from("Alice"),
    age: 30,
    active: true,
};

println!("{}", user.name);   // Access fields with dot notation, same as JS
```

### impl Blocks: Methods on Structs

Rust does not have classes. Instead, you add methods to a struct with an `impl` block:

```rust
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    // "Associated function" (like a static method) — no &self parameter
    // Called with Rectangle::new(10.0, 20.0)
    fn new(width: f64, height: f64) -> Self {
        Rectangle { width, height }   // Shorthand, like JS { width, height }
    }

    // Method — takes &self (borrows the instance)
    fn area(&self) -> f64 {
        self.width * self.height
    }

    // Mutable method — takes &mut self
    fn scale(&mut self, factor: f64) {
        self.width *= factor;
        self.height *= factor;
    }
}

let mut rect = Rectangle::new(10.0, 20.0);
println!("Area: {}", rect.area());     // 200.0
rect.scale(2.0);
println!("Area: {}", rect.area());     // 800.0
```

### Enums: Way More Powerful Than JS/TS

In TypeScript, enums are just named constants. In Rust, enum variants can carry data:

```typescript
// TypeScript
enum Direction {
  Up,
  Down,
  Left,
  Right,
}
```

```rust
// Rust — variants can hold data!
enum Message {
    Quit,                         // No data
    Echo(String),                 // Holds a String
    Move { x: i32, y: i32 },     // Holds named fields (like a struct)
    Color(u8, u8, u8),            // Holds a tuple of values
}
```

### Pattern Matching with `match`

`match` is like a supercharged `switch` statement. The compiler ensures you handle every variant:

```rust
fn process_message(msg: Message) {
    match msg {
        Message::Quit => println!("Quitting"),
        Message::Echo(text) => println!("Echo: {}", text),
        Message::Move { x, y } => println!("Moving to ({}, {})", x, y),
        Message::Color(r, g, b) => println!("Color: #{:02x}{:02x}{:02x}", r, g, b),
    }
}
```

### Option and Result: The Two Enums You Will Use Everywhere

Rust has no `null`, no `undefined`, no `NaN` surprise. Instead, it uses two built-in enums:

```rust
// Option<T> — a value that might not exist (replaces null/undefined)
enum Option<T> {
    Some(T),    // There is a value
    None,       // There is no value
}

// Result<T, E> — an operation that might fail (replaces try/catch)
enum Result<T, E> {
    Ok(T),      // Success, here is the value
    Err(E),     // Failure, here is the error
}
```

```rust
// Using Option
fn find_user(id: u32) -> Option<String> {
    if id == 1 {
        Some(String::from("Alice"))
    } else {
        None
    }
}

match find_user(1) {
    Some(name) => println!("Found: {}", name),
    None => println!("User not found"),
}

// Using if let (handy when you only care about one variant)
if let Some(name) = find_user(1) {
    println!("Found: {}", name);
}
```

---

## 7. Error Handling

### JS vs Rust

```javascript
// JavaScript — errors are runtime surprises
try {
  const data = JSON.parse(someString);
} catch (e) {
  console.error("Failed to parse:", e);
}
```

```rust
// Rust — errors are explicit in the type system
// You MUST handle them. The compiler enforces this.
let data: Result<Value, serde_json::Error> = serde_json::from_str(some_string);

match data {
    Ok(value) => println!("Parsed: {:?}", value),
    Err(e) => eprintln!("Failed to parse: {}", e),
}
```

### The `?` Operator: Rust's Secret Weapon

The `?` operator is syntactic sugar for "if this is an Err, return the error from the current function immediately; otherwise, unwrap the Ok value."

```rust
// Without ?  (verbose)
fn read_config() -> Result<String, std::io::Error> {
    let contents = match std::fs::read_to_string("config.json") {
        Ok(c) => c,
        Err(e) => return Err(e),
    };
    Ok(contents)
}

// With ?  (concise — does exactly the same thing)
fn read_config() -> Result<String, std::io::Error> {
    let contents = std::fs::read_to_string("config.json")?;
    Ok(contents)
}
```

You can chain `?` for multiple fallible operations:

```rust
fn load_user_settings() -> Result<Settings, Box<dyn std::error::Error>> {
    let contents = std::fs::read_to_string("settings.json")?;
    let settings: Settings = serde_json::from_str(&contents)?;
    Ok(settings)
}
```

### unwrap, expect, and When to Use Them

```rust
let value: Option<i32> = Some(42);

// unwrap() — panics (crashes) if None/Err. Use ONLY in examples or tests.
let v = value.unwrap();

// expect() — panics with a custom message. Slightly better for debugging.
let v = value.expect("value should always be present here");

// Proper handling — what you should do in production Tauri code
match value {
    Some(v) => println!("Got: {}", v),
    None => println!("No value"),
}

// Or use unwrap_or / unwrap_or_default for a fallback
let v = value.unwrap_or(0);           // Use 0 if None
let v = value.unwrap_or_default();    // Use the type's default (0 for i32)
```

### Error Handling in Tauri Commands

Tauri commands can return `Result` to propagate errors to the frontend:

```rust
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}
```

On the React side, this becomes a rejected promise:

```javascript
import { invoke } from "@tauri-apps/api/core";

try {
  const contents = await invoke("read_file", { path: "/some/file.txt" });
} catch (error) {
  console.error(error); // "Failed to read file: No such file or directory"
}
```

---

## 8. Collections

### Vec: Like a JS Array

```javascript
// JavaScript
const numbers = [1, 2, 3, 4, 5];
numbers.push(6);
console.log(numbers[0]);  // 1
```

```rust
// Rust
let mut numbers: Vec<i32> = vec![1, 2, 3, 4, 5];   // vec! macro creates a Vec
numbers.push(6);
println!("{}", numbers[0]);   // 1

// Other common operations
numbers.len();                 // Length (like .length)
numbers.is_empty();            // Like checking .length === 0
numbers.contains(&3);         // Like .includes(3)
numbers.pop();                 // Remove and return last element (returns Option<T>)
numbers.remove(0);             // Remove by index
```

### HashMap: Like a JS Object/Map

```javascript
// JavaScript
const scores = new Map();
scores.set("Alice", 100);
scores.set("Bob", 85);
console.log(scores.get("Alice"));  // 100
```

```rust
use std::collections::HashMap;

let mut scores = HashMap::new();
scores.insert("Alice", 100);
scores.insert("Bob", 85);

// get() returns Option<&V> — the value might not exist
match scores.get("Alice") {
    Some(score) => println!("Alice: {}", score),   // Alice: 100
    None => println!("Not found"),
}

// Or use if let
if let Some(score) = scores.get("Alice") {
    println!("Alice: {}", score);
}
```

### Iterators: Like JS Array Methods

Rust iterators map closely to JavaScript's `.map()`, `.filter()`, and `.reduce()`. The main difference is that you call `.collect()` at the end to produce a concrete collection.

```javascript
// JavaScript
const doubled = [1, 2, 3, 4, 5]
  .filter(x => x > 2)
  .map(x => x * 2);
// [6, 8, 10]
```

```rust
// Rust
let doubled: Vec<i32> = vec![1, 2, 3, 4, 5]
    .into_iter()
    .filter(|x| *x > 2)          // |x| is a closure (like arrow function)
    .map(|x| x * 2)
    .collect();                    // Must collect into a concrete type
// [6, 8, 10]
```

### Common Iterator Methods

| JS Method | Rust Equivalent | Notes |
|-----------|----------------|-------|
| `.map(fn)` | `.map(fn)` | Same concept |
| `.filter(fn)` | `.filter(fn)` | Closure receives a reference |
| `.find(fn)` | `.find(fn)` | Returns `Option<T>` |
| `.some(fn)` | `.any(fn)` | Returns `bool` |
| `.every(fn)` | `.all(fn)` | Returns `bool` |
| `.reduce(fn)` | `.fold(init, fn)` | Needs an initial value |
| `.forEach(fn)` | `.for_each(fn)` | Side effects only |
| `.flat()` | `.flatten()` | Flatten nested iterators |
| `.flatMap(fn)` | `.flat_map(fn)` | Map and flatten |
| `[...set]` (dedup) | `.collect::<HashSet<_>>()` | Collect into a set |

```rust
// More iterator examples

// Sum all values (like .reduce((a, b) => a + b, 0))
let total: i32 = vec![1, 2, 3, 4, 5].iter().sum();

// Find first match
let first_even: Option<&i32> = vec![1, 3, 4, 5].iter().find(|x| *x % 2 == 0);

// Count matching items
let even_count = vec![1, 2, 3, 4, 5].iter().filter(|x| *x % 2 == 0).count();

// Collect into a HashMap
let pairs: HashMap<&str, i32> = vec![("a", 1), ("b", 2)]
    .into_iter()
    .collect();

// Enumerate (like JS .entries() or .forEach((item, index) => ...))
for (index, value) in vec!["a", "b", "c"].iter().enumerate() {
    println!("{}: {}", index, value);
}
```

> **iter() vs into_iter()**: `iter()` borrows each element. `into_iter()` takes ownership (consumes the collection). If you need the original collection afterward, use `iter()`. If you are done with it, use `into_iter()`.

---

## 9. Traits

### Like TypeScript Interfaces, But More Powerful

In TypeScript, an interface defines a shape. In Rust, a trait defines behavior (methods a type must implement):

```typescript
// TypeScript
interface Displayable {
  display(): string;
}

class User implements Displayable {
  display(): string {
    return `User: ${this.name}`;
  }
}
```

```rust
// Rust
trait Displayable {
    fn display(&self) -> String;
}

struct User {
    name: String,
}

impl Displayable for User {
    fn display(&self) -> String {
        format!("User: {}", self.name)
    }
}
```

### Traits as Function Parameters

```rust
// Accept any type that implements Displayable
fn print_item(item: &impl Displayable) {
    println!("{}", item.display());
}

// Equivalent, more flexible syntax (needed for complex cases)
fn print_item<T: Displayable>(item: &T) {
    println!("{}", item.display());
}
```

### Derive Macros: The Traits You Will Use Every Day

Rust can auto-implement certain traits for your structs using `#[derive(...)]`. These are the ones you will use constantly in Tauri:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct User {
    name: String,
    age: u32,
    active: bool,
}
```

| Derive | What It Does | Why You Need It in Tauri |
|--------|-------------|-------------------------|
| `Debug` | Lets you print with `{:?}` for debugging | Debugging your structs |
| `Clone` | Lets you call `.clone()` to deep-copy | Needed when you pass data around |
| `Serialize` | Converts struct to JSON (via serde) | Returning data to the frontend |
| `Deserialize` | Converts JSON to struct (via serde) | Receiving data from the frontend |
| `PartialEq` | Enables `==` comparison | Comparing values |
| `Default` | Creates a default instance | Providing default config values |

`Serialize` and `Deserialize` come from the `serde` crate (add `serde = { version = "1", features = ["derive"] }` to your `Cargo.toml`). They are the backbone of Tauri's frontend-backend communication.

```rust
// This struct can be sent to the React frontend as JSON
#[derive(serde::Serialize, serde::Deserialize)]
struct TodoItem {
    id: u32,
    title: String,
    completed: bool,
}

#[tauri::command]
fn get_todos() -> Vec<TodoItem> {
    vec![
        TodoItem { id: 1, title: "Learn Rust".into(), completed: false },
        TodoItem { id: 2, title: "Build Tauri app".into(), completed: false },
    ]
}
```

In your React code, the data arrives as a plain JavaScript array of objects, already deserialized from JSON.

---

## 10. Modules and Crates

### JS vs Rust Module System

```javascript
// JavaScript
import { greet } from "./utils.js";
export function hello() { ... }
```

```rust
// Rust
mod utils;                      // Declares a module (loads utils.rs or utils/mod.rs)
use crate::utils::greet;        // Brings greet into scope

pub fn hello() { ... }          // "pub" makes it public (everything is private by default)
```

### Visibility: Private by Default

In JavaScript, everything is accessible unless you deliberately hide it. In Rust, everything is **private** by default. You must explicitly mark items as `pub` to make them accessible outside the module:

```rust
// src/models.rs
pub struct User {           // Struct is public
    pub name: String,       // Field is public
    age: u32,               // Field is PRIVATE — only accessible within this module
}

pub fn create_user(name: String) -> User {   // Function is public
    User { name, age: 0 }
}

fn internal_helper() { ... }   // Private function — only usable within models.rs
```

### Project Structure

A typical Tauri project's Rust side looks like this:

```
src-tauri/
├── Cargo.toml
├── src/
│   ├── main.rs          # Entry point — sets up the app
│   ├── lib.rs           # Library root (Tauri 2.x uses this)
│   ├── commands.rs      # Your Tauri commands
│   ├── models.rs        # Data structures
│   └── state.rs         # Application state
```

```rust
// src/lib.rs
mod commands;    // Loads src/commands.rs
mod models;      // Loads src/models.rs
mod state;       // Loads src/state.rs

// Now you can use items from these modules:
use commands::greet;
```

### Crates (External Packages)

Crates are Rust packages, found on [crates.io](https://crates.io). Add them to `Cargo.toml`:

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
```

Then use them in your code:

```rust
use serde::{Serialize, Deserialize};
use std::collections::HashMap;   // "std" is the standard library — always available
```

### Crates You Will Use in Tauri Projects

| Crate | Purpose |
|-------|---------|
| `serde` + `serde_json` | Serialize/deserialize JSON (frontend communication) |
| `tokio` | Async runtime (Tauri uses this under the hood) |
| `tauri` | The Tauri framework itself |
| `reqwest` | HTTP client (like fetch/axios) |
| `rusqlite` or `sqlx` | SQLite database access |
| `log` + `env_logger` | Logging |
| `chrono` | Date/time handling |
| `uuid` | Generate UUIDs |
| `anyhow` | Simplified error handling |
| `thiserror` | Custom error types |

---

## 11. Closures

### Like JS Arrow Functions

Closures in Rust are anonymous functions that can capture variables from their surrounding scope:

```javascript
// JavaScript
const numbers = [1, 2, 3];
const doubled = numbers.map(x => x * 2);

const multiplier = 3;
const tripled = numbers.map(x => x * multiplier);  // Captures "multiplier"
```

```rust
// Rust
let numbers = vec![1, 2, 3];
let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();

let multiplier = 3;
let tripled: Vec<i32> = numbers.iter().map(|x| x * multiplier).collect();
```

### Closure Syntax

```rust
// Various closure forms
let add = |a, b| a + b;                        // Type inferred
let add = |a: i32, b: i32| -> i32 { a + b };   // Types explicit
let print_hi = || println!("hi");              // No parameters
let complex = |x| {                            // Multi-line body
    let y = x * 2;
    y + 1
};
```

### The `move` Keyword

By default, closures borrow captured variables. The `move` keyword forces the closure to take ownership. This is important when the closure might outlive the current scope (common with threads and async code):

```rust
let name = String::from("Alice");

// This closure takes ownership of "name"
let greeting = move || {
    println!("Hello, {}!", name);
};

// println!("{}", name);   // ERROR: name has been moved into the closure

greeting();   // "Hello, Alice!"
```

**When will you see `move` in Tauri?** When passing closures to Tauri's setup hooks, event handlers, or spawning async tasks:

```rust
let app_data = String::from("important data");

// Tauri event handler — the closure must own its data because
// it may be called at any time in the future
app.listen("my-event", move |event| {
    println!("Got event with data: {}", app_data);
});
```

---

## 12. Async/Await

### JS Async vs Rust Async

If you know JavaScript's `async`/`await`, the Rust version will look familiar. The key difference is that Rust needs an **async runtime** (like `tokio`) to actually execute async code, whereas JavaScript has one built into the engine.

```javascript
// JavaScript — async is built into the language runtime
async function fetchData(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}
```

```rust
// Rust — needs an async runtime (tokio). Tauri provides this for you.
async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    let response = reqwest::get(url).await?;
    let body = response.text().await?;
    Ok(body)
}
```

### Async in Tauri Commands

Tauri commands can be async. Tauri runs them on its own tokio runtime, so you do not need to set one up yourself:

```rust
#[tauri::command]
async fn fetch_weather(city: String) -> Result<String, String> {
    let url = format!("https://api.weather.example.com/{}", city);
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;
    let body = response.text()
        .await
        .map_err(|e| e.to_string())?;
    Ok(body)
}
```

On the React side, calling this is the same as calling a sync command — `invoke` always returns a Promise:

```javascript
const weather = await invoke("fetch_weather", { city: "London" });
```

### When to Use Async in Tauri

Use async commands for operations that would block the main thread:

- **HTTP requests** (fetching APIs)
- **File I/O** (reading/writing large files)
- **Database queries**
- **Any long-running computation** (move to a background task)

For quick, CPU-bound operations (string manipulation, simple calculations), synchronous commands are fine.

### Spawning Background Tasks

Sometimes you need to run something in the background without blocking the command response:

```rust
use tokio::task;

#[tauri::command]
async fn start_background_job() -> String {
    // Spawn a task that runs independently
    task::spawn(async {
        // This runs in the background
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        println!("Background job finished!");
    });

    // Return immediately — don't wait for the background task
    "Job started".to_string()
}
```

---

## 13. Coding Challenges

Test your understanding with these challenges. Each one builds on concepts from this module and relates to what you will do in Tauri.

---

### Challenge 1: Configuration Parser (Beginner)

**What to build**: A function that parses a simple configuration string into a `HashMap`.

**Requirements**:
- Write a function `parse_config(input: &str) -> HashMap<String, String>` that takes a multi-line string where each line is `key=value` and returns a `HashMap`.
- Skip empty lines and lines that start with `#` (comments).
- Trim whitespace from keys and values.
- Handle the case where a line has no `=` by skipping it.

**Example input**:
```
# App settings
name = My Tauri App
version = 1.0.0

debug = true
# database_url = postgres://localhost/mydb
```

**Expected output**: A `HashMap` with keys `"name"`, `"version"`, `"debug"`.

**Hints**:
- Use `.lines()` to iterate over lines in a string.
- Use `.starts_with('#')` to check for comments.
- Use `.splitn(2, '=')` to split on the first `=` only (values might contain `=`).
- Use `.trim()` to clean up whitespace.
- Collect into a `HashMap` with `.collect()`, or build it with a loop and `.insert()`.

---

### Challenge 2: Todo List Data Model (Intermediate)

**What to build**: A `TodoList` struct with methods that manage todo items, similar to what you would build in a Tauri app.

**Requirements**:
- Define a `TodoItem` struct with fields: `id: u32`, `title: String`, `completed: bool`.
- Define a `TodoList` struct that holds a `Vec<TodoItem>` and a `next_id: u32` counter.
- Implement these methods on `TodoList`:
  - `new() -> TodoList` — create an empty list
  - `add(&mut self, title: String) -> &TodoItem` — add a new item, auto-assign an id
  - `complete(&mut self, id: u32) -> Result<(), String>` — mark an item as completed, return `Err` if id not found
  - `remove(&mut self, id: u32) -> Result<TodoItem, String>` — remove and return an item, return `Err` if not found
  - `list_pending(&self) -> Vec<&TodoItem>` — return references to all incomplete items
- Derive `Debug` and `Clone` on your structs.

**Hints**:
- Use `.iter().position(|item| item.id == id)` to find an item's index.
- Use `.retain(|item| item.id != id)` or `.remove(index)` to delete.
- Remember: `&mut self` methods let you modify the struct.
- Returning `Result<(), String>` uses the unit type `()` for "nothing to return on success."

---

### Challenge 3: File Statistics (Intermediate)

**What to build**: A function that reads a text file and returns statistics about it, using proper error handling.

**Requirements**:
- Create a `FileStats` struct with: `line_count: usize`, `word_count: usize`, `char_count: usize`, `most_common_word: String`.
- Write a function `analyze_file(path: &str) -> Result<FileStats, Box<dyn std::error::Error>>` that reads a file and computes these stats.
- Use the `?` operator for error propagation.
- Use iterators (`.lines()`, `.split_whitespace()`, `.filter()`, `.map()`, etc.).
- Words should be compared case-insensitively.

**Hints**:
- `std::fs::read_to_string(path)?` reads a file into a `String`.
- Use a `HashMap<String, usize>` to count word frequencies.
- `.to_lowercase()` for case-insensitive comparison.
- `.max_by_key(|entry| entry.1)` to find the most common word in the HashMap.
- Remember to handle the case where the file is empty.

---

### Challenge 4: Command Registry with Traits (Advanced)

**What to build**: A mini command system similar to how Tauri dispatches commands from the frontend to backend functions.

**Requirements**:
- Define a trait `Command` with:
  - `fn name(&self) -> &str` — the command name
  - `fn execute(&self, args: &str) -> Result<String, String>` — run the command
- Implement at least three commands: `GreetCommand`, `MathCommand` (parses two numbers and an operator from args), and `EchoCommand`.
- Build a `CommandRegistry` struct that:
  - Stores commands in a `HashMap<String, Box<dyn Command>>`
  - Has `register(&mut self, cmd: Box<dyn Command>)` to add commands
  - Has `dispatch(&self, name: &str, args: &str) -> Result<String, String>` to find and execute a command
- Return a meaningful error if the command is not found.

**Hints**:
- `Box<dyn Command>` is a "trait object" — it lets you store different types that implement the same trait in a single collection.
- For `MathCommand`, use `args.split_whitespace()` to parse something like `"5 + 3"`.
- `.parse::<f64>()` converts a string to a number and returns `Result`.
- Think about how this pattern maps to `#[tauri::command]` — Tauri does something conceptually similar under the hood.

---

### Challenge 5: Async Data Fetcher (Advanced)

**What to build**: An async program that fetches data from multiple URLs concurrently and aggregates results.

**Requirements**:
- Add `tokio = { version = "1", features = ["full"] }` and `reqwest = { version = "0.12", features = ["json"] }` to your `Cargo.toml`.
- Write an async function `fetch_all(urls: Vec<String>) -> Vec<Result<String, String>>` that fetches all URLs concurrently (not sequentially).
- Use `tokio::join!` or `futures::future::join_all` for concurrent execution.
- Each fetch should have a timeout of 5 seconds.
- Write a `#[tokio::main]` async main function that calls `fetch_all` with a list of URLs and prints results.

**Hints**:
- `reqwest::get(url).await` fetches a URL.
- `tokio::time::timeout(Duration, future)` wraps a future with a timeout.
- To run futures concurrently, create a `Vec` of futures and pass it to `futures::future::join_all`.
- Map errors with `.map_err(|e| e.to_string())` to convert different error types into `String`.
- This pattern is directly applicable to Tauri commands that need to fetch from multiple APIs.

---

## What's Next?

You now have enough Rust knowledge to start building with Tauri. You do not need to master every concept before moving on — you will reinforce these skills by using them in real Tauri code.

Proceed to [Module 02: Tauri Basics](../02-tauri-basics/README.md) to set up your first Tauri application.

**Keep this module as a reference.** You will come back to it when:
- The compiler gives you ownership/borrowing errors
- You need to remember the difference between `String` and `&str`
- You want to look up iterator methods
- You need to figure out error handling patterns
