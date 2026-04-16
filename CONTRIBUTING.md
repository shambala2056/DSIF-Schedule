# Оролцох заавар

## Төсөл нэмэх
1. Repo-г fork / шинэ branch үүсгэ (`git checkout -b add-my-project`)
2. Өөрийн төслийн HTML файлыг нэмэ (жишээ: `my-project.html`) — загвар нь `huvsgul-emneleg.html`-тэй адил байх ёстой
3. `.github/CODEOWNERS`-д өөрийн нэрийг нэмж бич:
   ```
   /my-project.html   @shambala2056 @your-github-username
   ```
4. `tusul.html`-д карт нэмэ
5. Pull Request илгээ — admin (`@shambala2056`) шалгаж merge хийнэ

## Төсөл устгах
- **Зөвхөн өөрийн** төслийг л устгах боломжтой
- Устгах PR илгээ → CODEOWNERS-ийн улмаас тухайн файлын эзэн (та) + admin хоёулаа approve хийх шаардлагатай
- Өөр хүний төслийг устгахыг оролдсон PR нь тэр хүний зөвшөөрөлгүй merge хийгдэхгүй

## Шууд push хийх хориотой
`main` branch рүү шууд push хийх боломжгүй — бүх өөрчлөлт PR-ээр дамжина.
