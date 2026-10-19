/** Finish the old editor lifecycle before another record takes ownership of its resources. */
export async function closeDrawingEditors(editors) {
  await Promise.all(
    editors
      .filter((editor) => editor.dialog.open)
      .map(
        (editor) =>
          new Promise((resolve) => {
            editor.dialog.addEventListener('close', resolve, { once: true });
            editor.dialog.close();
          }),
      ),
  );
}
