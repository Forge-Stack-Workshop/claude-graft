# Verification — reading is not running

**A command that has not been executed does not work; it is a hypothesis.**
This bites hardest on the files nobody runs directly: Dockerfiles, compose
files, Makefiles, CI workflows, settings modules. They look right for a long
time.

- **Every command you write down, you run.** Not a similar one, not the one
  underneath it — the command as the reader will type it, from the directory
  the reader will be in.
- **Every URL you hand over, you request.** And not only that a page renders:
  check that what it references resolves too. An application can serve a page
  perfectly while every asset it points at returns 404.
- **Every gate you call green, you have seen output for.** Output worth
  pasting, not an inference from the absence of an error.
- **A first run on the machine where the work was just done proves little.**
  Ask what a second machine lacks: a warm cache, a free port, a different uid,
  a file that only exists because you created it by hand an hour ago.
- **Report what happened, including the failures.** The defects a build found
  in your own work are the most useful thing you learned; they belong in the
  report, not in the silence between two green checkmarks.

**The rule of thumb:** if the only evidence is that it looks right, it is not
verified. Infrastructure fails in ways reading cannot reveal — a shell
metacharacter in a recipe, a mount hiding a file, a port already taken, a
permission that differs by one bit.
