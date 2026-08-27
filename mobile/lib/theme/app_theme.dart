import 'package:flutter/material.dart';

/// Palet warna & tema mengikuti brand MyGCS (lihat frontend/src/index.css)
/// supaya app mobile terasa satu keluarga dengan web.
class AppColors {
  AppColors._();

  static const green900 = Color(0xFF0F261F);
  static const green700 = Color(0xFF347645);
  static const gold500 = Color(0xFFF4AE46);
  static const gold700 = Color(0xFFDAA628);
  static const white = Color(0xFFFFFFFF);
  static const danger = Color(0xFFD63C32);
}

class AppTheme {
  AppTheme._();

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.green900,
        primary: AppColors.green900,
        secondary: AppColors.gold500,
        error: AppColors.danger,
      ),
    );
    return base.copyWith(
      scaffoldBackgroundColor: const Color(0xFFF7F5EF),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.green900,
        foregroundColor: AppColors.white,
        centerTitle: false,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.gold500,
          foregroundColor: AppColors.green900,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: AppColors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFE4DDCC)),
        ),
      ),
    );
  }
}
