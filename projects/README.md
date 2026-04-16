# Projects

Хүн бүр өөрийн төслийг тохирох салбарын folder дотор үүсгэнэ.

## Бүтэц

```
projects/
├── energy/        Эрчим хүч
├── mining/        Уул уурхай
├── environment/   Байгаль орчин
├── infra/         Дэд бүтэц
├── edu/           Боловсрол
├── culture/       Соёл
├── health/        Эрүүл мэнд
├── social/        Нийгэм
└── agri/          Хөдөө аж ахуй
    └── <project-name>/
        ├── index.html     — төслийн үндсэн HTML
        └── thumbnail.jpg  — картны зураг
```

## Төсөл нэмэх

1. Өөрийн салбарын folder дотор `<project-name>/` folder үүсгэ
2. `index.html` — загвар нь `projects/health/huvsgul-emneleg/index.html`-тэй адил байх
3. `thumbnail.jpg` — картны зураг оруул
4. `tusul.html`-д card нэмж, `href="projects/<sector>/<project-name>/index.html"`-ыг заа
5. `.github/CODEOWNERS`-д өөрийн folder-ийн эзэмшлийг бичиж нэм:
   ```
   /projects/<sector>/<project-name>/   @shambala2056 @your-github-username
   ```
6. PR илгээ

## Өөрийн төслийг устгах

- Зөвхөн өөрийн project folder-ийг л устгана
- PR үүсгэсний дараа CODEOWNERS-ийн улмаас тухайн folder-ийн эзэн + admin хоёулаа approve хийснээр merge болно
- Өөр хүний folder-ийг устгахыг оролдсон PR автоматаар татгалзагдана
